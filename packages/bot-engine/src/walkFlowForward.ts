import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import { BubbleBlockType } from "@typebot.io/blocks-bubbles/constants";
import type { DataBubbleBlock } from "@typebot.io/blocks-bubbles/data/schema";
import {
  isBubbleBlock,
  isInputBlock,
  isIntegrationBlock,
  isLogicBlock,
} from "@typebot.io/blocks-core/helpers";
import type {
  ContinueChatResponse,
  InputMessage,
} from "@typebot.io/chat-api/schemas";
import type { SessionState } from "@typebot.io/chat-session/schemas";
import { env } from "@typebot.io/env";
import type { Group } from "@typebot.io/groups/schemas";
import { byId, isDefined, isNotDefined } from "@typebot.io/lib/utils";
import type { Prisma } from "@typebot.io/prisma/types";
import type { SessionStore } from "@typebot.io/runtime-session-store";
import { parseVariables } from "@typebot.io/variables/parseVariables";
import type {
  SetVariableHistoryItem,
  VariableWithValue,
} from "@typebot.io/variables/schemas";
import { executeIntegration } from "./executeIntegration";
import { executeLogic } from "./executeLogic";
import { formatInputForChatResponse } from "./formatInputForChatResponse";
import {
  type BubbleBlockWithDefinedContent,
  parseBubbleBlock,
} from "./parseBubbleBlock";
import { upsertResult } from "./queries/upsertResult";
import type { ExecuteIntegrationResponse, ExecuteLogicResponse } from "./types";
import { updateVariablesInSession } from "./updateVariablesInSession";

export type WalkFlowStartingPoint =
  | { type: "group"; group: Group }
  | {
      type: "nextEdge";
      nextEdge?: { id: string; isOffDefaultPath: boolean };
    };

export const walkFlowForward = async (
  startingPoint: WalkFlowStartingPoint,
  {
    state,
    sessionStore,
    version,
    setVariableHistory,
    skipFirstMessageBubble,
    textBubbleContentFormat,
  }: {
    version: 1 | 2;
    state: SessionState;
    sessionStore: SessionStore;
    setVariableHistory: SetVariableHistoryItem[];
    /**
     * Useful to skip the last message that was streamed to the client so we don't need to send it again
     */
    skipFirstMessageBubble?: boolean;
    textBubbleContentFormat: "richText" | "markdown";
  },
) => {
  let timeoutStartTime = Date.now();

  const visitedEdges: Prisma.VisitedEdge[] = [];
  let newSessionState: SessionState = state;

  let input: ContinueChatResponse["input"] | undefined;
  const messages: ContinueChatResponse["messages"] = [];
  const logs: ContinueChatResponse["logs"] = [];
  const clientSideActions: ContinueChatResponse["clientSideActions"] = [];
  let nextEdge: { id: string; isOffDefaultPath: boolean } | undefined =
    startingPoint.type === "nextEdge" ? startingPoint.nextEdge : undefined;
  let lastBubbleBlockId: string | undefined;

  let i = -1;
  do {
    i += 1;
    const nextGroupResponse =
      i === 0 && startingPoint.type === "group" && !nextEdge
        ? {
            group: startingPoint.group,
            newSessionState,
          }
        : await navigateToNextGroupAndUpdateState({
            state: newSessionState,
            edgeId: nextEdge?.id,
            isOffDefaultPath: nextEdge?.isOffDefaultPath ?? false,
            sessionStore,
          });
    newSessionState = nextGroupResponse.newSessionState;
    if (nextGroupResponse.visitedEdge)
      visitedEdges.push(nextGroupResponse.visitedEdge);
    if (!nextGroupResponse?.group) break;
    const executionResponse = await executeGroup(nextGroupResponse.group, {
      version,
      state: newSessionState,
      setVariableHistory,
      visitedEdges,
      skipFirstMessageBubble,
      timeoutStartTime,
      textBubbleContentFormat,
      sessionStore,
      currentLastBubbleId: lastBubbleBlockId,
    });
    if (executionResponse.logs) logs.push(...executionResponse.logs);
    newSessionState = executionResponse.newSessionState;
    if (executionResponse.newSetVariableHistoryItems)
      setVariableHistory.push(...executionResponse.newSetVariableHistoryItems);
    if (executionResponse.messages)
      messages.push(...executionResponse.messages);
    if (executionResponse.input) input = executionResponse.input;
    if (executionResponse.clientSideActions)
      clientSideActions.push(...executionResponse.clientSideActions);
    if (executionResponse.updatedTimeoutStartTime)
      timeoutStartTime = executionResponse.updatedTimeoutStartTime;
    lastBubbleBlockId = executionResponse.lastBubbleBlockId;

    nextEdge = executionResponse.nextEdge;
  } while (
    nextEdge ||
    (!input &&
      !isDedicatedReplyNeeded({ clientSideActions, messages }) &&
      (newSessionState.typebotsQueue[0].queuedEdgeIds?.length ||
        newSessionState.typebotsQueue.length > 1))
  );

  // Extract customData from variables set by data bubbles in this execution
  const customData = extractCustomDataFromExecution(
    setVariableHistory,
    newSessionState,
  );

  return {
    messages,
    input,
    clientSideActions:
      clientSideActions.length > 0 ? clientSideActions : undefined,
    newSessionState,
    logs: logs.length > 0 ? logs : undefined,
    visitedEdges,
    setVariableHistory,
    customData: Object.keys(customData).length > 0 ? customData : undefined,
  };
};

const isDedicatedReplyNeeded = ({
  clientSideActions,
  messages,
}: {
  clientSideActions: ContinueChatResponse["clientSideActions"];
  messages: ContinueChatResponse["messages"];
}) =>
  // Either a client side action expects a dedicated reply or the last message is an embed which means it waits for an event
  clientSideActions?.some((ca) => ca.expectsDedicatedReply) ||
  messages.at(-1)?.type === BubbleBlockType.EMBED;

type ContextProps = {
  version: 1 | 2;
  state: SessionState;
  sessionStore: SessionStore;
  currentLastBubbleId?: string;
  skipFirstMessageBubble?: boolean;
  setVariableHistory: SetVariableHistoryItem[];
  timeoutStartTime?: number;
  textBubbleContentFormat: "richText" | "markdown";
  visitedEdges: Prisma.VisitedEdge[];
};

export type ExecuteGroupResponse = ContinueChatResponse & {
  newSessionState: SessionState;
  newSetVariableHistoryItems: SetVariableHistoryItem[];
  updatedTimeoutStartTime?: number;
  nextEdge?: {
    id: string;
    isOffDefaultPath: boolean;
  };
  lastBubbleBlockId: string | undefined;
};

const executeGroup = async (
  group: Group,
  {
    version,
    state,
    sessionStore,
    setVariableHistory,
    currentLastBubbleId,
    skipFirstMessageBubble,
    timeoutStartTime,
    textBubbleContentFormat,
    visitedEdges,
  }: ContextProps,
): Promise<ExecuteGroupResponse> => {
  const messages: ContinueChatResponse["messages"] = [];
  let clientSideActions: ContinueChatResponse["clientSideActions"] = [];
  let logs: ContinueChatResponse["logs"] = [];
  let nextEdge;
  let lastBubbleBlockId: string | undefined = currentLastBubbleId;
  let updatedTimeoutStartTime = timeoutStartTime;
  const newSetVariableHistoryItems: SetVariableHistoryItem[] = [];
  let newSessionState = state;

  let index = -1;
  for (const block of group.blocks) {
    if (
      updatedTimeoutStartTime &&
      env.CHAT_API_TIMEOUT &&
      Date.now() - updatedTimeoutStartTime > env.CHAT_API_TIMEOUT
    ) {
      throw new TRPCError({
        code: "TIMEOUT",
        message: `${env.CHAT_API_TIMEOUT / 1000} seconds timeout reached`,
      });
    }

    index++;
    nextEdge = block.outgoingEdgeId
      ? {
          id: block.outgoingEdgeId,
          isOffDefaultPath: false,
        }
      : undefined;

    if (isBubbleBlock(block)) {
      if (!block.content || (skipFirstMessageBubble && index === 0)) continue;

      // Handle data bubble variable setting
      if (block.type === BubbleBlockType.DATA) {
        const dataBubble = block as DataBubbleBlock;
        if (dataBubble.content?.variables) {
          const variablesToUpdate =
            dataBubble.content.variables
              ?.map((dataVar) => {
                const mode = dataVar.mode || "variable";

                if (mode === "variable") {
                  // Variable mode - existing logic
                  if (!dataVar.variableId) return null;

                  const existingVariable =
                    newSessionState.typebotsQueue[0].typebot.variables.find(
                      (v) => v.id === dataVar.variableId,
                    );

                  if (!existingVariable) return null;

                  // If no custom value is set, use current variable value
                  if (!dataVar.value || dataVar.value.trim() === "") {
                    return {
                      ...existingVariable,
                      value: existingVariable.value,
                    };
                  }

                  // Clean value: if it's wrapped in quotes from frontend, unwrap it
                  let cleanValue = dataVar.value;
                  if (
                    cleanValue.startsWith('"') &&
                    cleanValue.endsWith('"') &&
                    cleanValue.length > 2
                  ) {
                    cleanValue = cleanValue.slice(1, -1);
                  }

                  // Parse the value with variables
                  const parsedValue = parseVariables(cleanValue, {
                    variables:
                      newSessionState.typebotsQueue[0].typebot.variables,
                    sessionStore,
                  });

                  return {
                    ...existingVariable,
                    value: parsedValue,
                  };
                } else if (mode === "custom") {
                  // Custom field mode - create temporary variable for tracking
                  if (
                    !dataVar.customKey ||
                    !dataVar.value ||
                    dataVar.value.trim() === ""
                  )
                    return null;

                  // Clean value: if it's wrapped in quotes from frontend, unwrap it
                  let cleanValue = dataVar.value;
                  if (
                    cleanValue.startsWith('"') &&
                    cleanValue.endsWith('"') &&
                    cleanValue.length > 2
                  ) {
                    cleanValue = cleanValue.slice(1, -1);
                  }

                  // Parse the value with variables
                  const parsedValue = parseVariables(cleanValue, {
                    variables:
                      newSessionState.typebotsQueue[0].typebot.variables,
                    sessionStore,
                  });

                  // Create a temporary variable for custom field tracking
                  return {
                    id: `__custom_field_${dataVar.customKey}_${block.id}`,
                    name: dataVar.customKey,
                    value: parsedValue,
                    isCustomField: true, // Mark as custom field
                  };
                }

                return null;
              })
              .filter(isDefined) || [];

          if (variablesToUpdate.length > 0) {
            const { newSetVariableHistory, updatedState } =
              updateVariablesInSession({
                state: newSessionState,
                newVariables: variablesToUpdate,
                currentBlockId: block.id,
              });
            newSessionState = updatedState;
            newSetVariableHistoryItems.push(...newSetVariableHistory);
          }
        }
        // Data bubbles don't produce visible messages, so continue to next block
        continue;
      }

      const message = parseBubbleBlock(block as BubbleBlockWithDefinedContent, {
        version,
        variables: newSessionState.typebotsQueue[0].typebot.variables,
        typebotVersion: newSessionState.typebotsQueue[0].typebot.version,
        textBubbleContentFormat,
        sessionStore,
      });
      messages.push(message);
      if (
        message.type === BubbleBlockType.EMBED &&
        message.content.waitForEvent?.isEnabled
      ) {
        return {
          messages,
          newSessionState: {
            ...newSessionState,
            currentBlockId: block.id,
          },
          clientSideActions,
          logs,
          newSetVariableHistoryItems,
          lastBubbleBlockId,
        };
      }

      lastBubbleBlockId = block.id;
      continue;
    }

    if (isInputBlock(block))
      return {
        messages,
        input: await formatInputForChatResponse(block, {
          state: newSessionState,
          sessionStore,
        }),
        newSessionState: {
          ...newSessionState,
          currentBlockId: block.id,
        },
        clientSideActions,
        logs,
        newSetVariableHistoryItems,
        lastBubbleBlockId,
      };
    const logicOrIntegrationExecutionResponse = (
      isLogicBlock(block)
        ? await executeLogic({
            block,
            state: newSessionState,
            setVariableHistory,
            visitedEdges,
            sessionStore,
          })
        : isIntegrationBlock(block)
          ? await executeIntegration({
              block,
              state: newSessionState,
              sessionStore,
            })
          : null
    ) as ExecuteLogicResponse | ExecuteIntegrationResponse | null;

    if (!logicOrIntegrationExecutionResponse) continue;
    if (
      logicOrIntegrationExecutionResponse.newSetVariableHistory &&
      logicOrIntegrationExecutionResponse.newSetVariableHistory?.length > 0
    ) {
      if (!newSessionState.typebotsQueue[0].resultId)
        newSessionState = {
          ...newSessionState,
          previewMetadata: {
            ...newSessionState.previewMetadata,
            setVariableHistory: (
              newSessionState.previewMetadata?.setVariableHistory ?? []
            ).concat(
              logicOrIntegrationExecutionResponse.newSetVariableHistory.map(
                (item) => ({
                  blockId: item.blockId,
                  variableId: item.variableId,
                  value: item.value,
                }),
              ),
            ),
          },
        };
      else
        newSetVariableHistoryItems.push(
          ...logicOrIntegrationExecutionResponse.newSetVariableHistory,
        );
    }

    if (
      "startTimeShouldBeUpdated" in logicOrIntegrationExecutionResponse &&
      logicOrIntegrationExecutionResponse.startTimeShouldBeUpdated
    )
      updatedTimeoutStartTime = Date.now();
    if (logicOrIntegrationExecutionResponse.logs)
      logs = [...(logs ?? []), ...logicOrIntegrationExecutionResponse.logs];
    if (logicOrIntegrationExecutionResponse.newSessionState)
      newSessionState = logicOrIntegrationExecutionResponse.newSessionState;
    if (
      "clientSideActions" in logicOrIntegrationExecutionResponse &&
      logicOrIntegrationExecutionResponse.clientSideActions
    ) {
      clientSideActions = [
        ...(clientSideActions ?? []),
        ...logicOrIntegrationExecutionResponse.clientSideActions.map(
          (action) => ({
            ...action,
            lastBubbleBlockId,
          }),
        ),
      ];
      if (
        "customEmbedBubble" in logicOrIntegrationExecutionResponse &&
        logicOrIntegrationExecutionResponse.customEmbedBubble
      ) {
        messages.push({
          id: createId(),
          ...logicOrIntegrationExecutionResponse.customEmbedBubble,
        });
      }
      if (
        logicOrIntegrationExecutionResponse.clientSideActions?.find(
          (action) => action.expectsDedicatedReply,
        ) ||
        ("customEmbedBubble" in logicOrIntegrationExecutionResponse &&
          logicOrIntegrationExecutionResponse.customEmbedBubble)
      ) {
        return {
          messages,
          newSessionState: {
            ...newSessionState,
            currentBlockId: block.id,
          },
          clientSideActions,
          logs,
          newSetVariableHistoryItems,
          lastBubbleBlockId,
        };
      }
    }

    if (logicOrIntegrationExecutionResponse.outgoingEdgeId) {
      nextEdge = {
        id: logicOrIntegrationExecutionResponse.outgoingEdgeId,
        isOffDefaultPath:
          block.outgoingEdgeId !==
          logicOrIntegrationExecutionResponse.outgoingEdgeId,
      };
      break;
    }

    if (logicOrIntegrationExecutionResponse.outgoingEdgeId === null) {
      nextEdge = undefined;
      break;
    }
  }

  return {
    nextEdge,
    messages,
    newSessionState,
    clientSideActions,
    updatedTimeoutStartTime,
    logs,
    newSetVariableHistoryItems,
    lastBubbleBlockId,
  };
};

type NextGroup = {
  group?: Group;
  newSessionState: SessionState;
  visitedEdge?: Prisma.VisitedEdge;
};

const navigateToNextGroupAndUpdateState = async ({
  state,
  edgeId,
  isOffDefaultPath,
  sessionStore,
}: {
  state: SessionState;
  edgeId?: string;
  isOffDefaultPath: boolean;
  sessionStore: SessionStore;
}): Promise<NextGroup> => {
  const nextEdge = state.typebotsQueue[0].typebot.edges.find(byId(edgeId));
  if (!nextEdge) {
    const queuedEdgeResponse = popQueuedEdge(state);

    let newSessionState = queuedEdgeResponse.state;

    if (newSessionState.typebotsQueue.length > 1) {
      const isMergingWithParent =
        newSessionState.typebotsQueue[0].isMergingWithParent;
      const currentResultId = newSessionState.typebotsQueue[0].resultId;
      if (!isMergingWithParent && currentResultId)
        await upsertResult({
          resultId: currentResultId,
          typebot: newSessionState.typebotsQueue[0].typebot,
          isCompleted: true,
          hasStarted: newSessionState.typebotsQueue[0].answers.length > 0,
        });
      newSessionState = {
        ...newSessionState,
        typebotsQueue: [
          {
            ...newSessionState.typebotsQueue[1],
            typebot: isMergingWithParent
              ? {
                  ...newSessionState.typebotsQueue[1].typebot,
                  variables: newSessionState.typebotsQueue[1].typebot.variables
                    .map((variable) => ({
                      ...variable,
                      value:
                        newSessionState.typebotsQueue[0].typebot.variables.find(
                          (v) => v.name === variable.name,
                        )?.value ?? variable.value,
                    }))
                    .concat(
                      newSessionState.typebotsQueue[0].typebot.variables.filter(
                        (variable) =>
                          isDefined(variable.value) &&
                          isNotDefined(
                            newSessionState.typebotsQueue[1].typebot.variables.find(
                              (v) => v.name === variable.name,
                            ),
                          ),
                      ) as VariableWithValue[],
                    ),
                }
              : newSessionState.typebotsQueue[1].typebot,
            answers: isMergingWithParent
              ? [
                  ...newSessionState.typebotsQueue[1].answers.filter(
                    (incomingAnswer) =>
                      !newSessionState.typebotsQueue[0].answers.find(
                        (currentAnswer) =>
                          currentAnswer.key === incomingAnswer.key,
                      ),
                  ),
                  ...newSessionState.typebotsQueue[0].answers,
                ]
              : newSessionState.typebotsQueue[1].answers,
          },
          ...newSessionState.typebotsQueue.slice(2),
        ],
      } satisfies SessionState;
      if (newSessionState.progressMetadata)
        newSessionState.progressMetadata = {
          ...newSessionState.progressMetadata,
          totalAnswers:
            newSessionState.progressMetadata.totalAnswers +
            newSessionState.typebotsQueue[0].answers.length,
        };
    }
    if (
      queuedEdgeResponse.edgeId ||
      newSessionState.typebotsQueue[0].queuedEdgeIds?.length
    )
      return navigateToNextGroupAndUpdateState({
        state: newSessionState,
        edgeId: queuedEdgeResponse.edgeId,
        isOffDefaultPath,
        sessionStore,
      });
    return {
      newSessionState,
    };
  }
  const nextGroup = state.typebotsQueue[0].typebot.groups.find(
    byId(nextEdge.to.groupId),
  );
  if (!nextGroup)
    return {
      newSessionState: state,
    };
  const startBlockIndex = nextEdge.to.blockId
    ? nextGroup.blocks.findIndex(byId(nextEdge.to.blockId))
    : 0;
  const currentVisitedEdgeIndex = isOffDefaultPath
    ? (state.currentVisitedEdgeIndex ?? -1) + 1
    : state.currentVisitedEdgeIndex;
  const resultId = state.typebotsQueue[0].resultId;
  return {
    group: {
      ...nextGroup,
      blocks: nextGroup.blocks.slice(startBlockIndex),
    } as Group,
    newSessionState: {
      ...state,
      currentVisitedEdgeIndex,
      previewMetadata:
        resultId || !isOffDefaultPath
          ? state.previewMetadata
          : {
              ...state.previewMetadata,
              visitedEdges: (state.previewMetadata?.visitedEdges ?? []).concat(
                nextEdge.id,
              ),
            },
    },
    visitedEdge:
      resultId && isOffDefaultPath
        ? {
            index: currentVisitedEdgeIndex as number,
            edgeId: nextEdge.id,
            resultId,
          }
        : undefined,
  };
};

const popQueuedEdge = (
  state: SessionState,
): { edgeId?: string; state: SessionState } => {
  const queuedEdgeId = state.typebotsQueue[0].queuedEdgeIds?.[0];
  if (!queuedEdgeId) return { state };
  return {
    edgeId: queuedEdgeId,
    state: {
      ...state,
      typebotsQueue: [
        {
          ...state.typebotsQueue[0],
          queuedEdgeIds: state.typebotsQueue[0].queuedEdgeIds?.slice(1),
        },
        ...state.typebotsQueue.slice(1),
      ],
    },
  };
};

const extractCustomDataFromExecution = (
  setVariableHistory: SetVariableHistoryItem[],
  state: SessionState,
): Record<string, any> => {
  const customData: Record<string, any> = {};

  // Get all data bubble blocks and their selected variables
  const allBlocks =
    state.typebotsQueue[0]?.typebot.groups.flatMap(
      (group) => group.blocks as any[],
    ) || [];
  const dataBubbles = allBlocks.filter(
    (block: any) => block.type === BubbleBlockType.DATA,
  );

  // Collect all variables/custom fields that should be included in customData
  const selectedVariableIds = new Set<string>();
  const customFieldKeys = new Set<string>();

  dataBubbles.forEach((bubble: any) => {
    if (bubble.content?.variables) {
      bubble.content.variables.forEach((variable: any) => {
        if (variable.mode === "custom" && variable.customKey) {
          // Custom field mode
          customFieldKeys.add(variable.customKey);
        } else if (variable.variableId) {
          // Existing variable mode
          selectedVariableIds.add(variable.variableId);
        }
      });
    }
  });

  // Only include variables that were selected in data bubbles
  const variables = state.typebotsQueue[0]?.typebot.variables || [];
  setVariableHistory.forEach((change) => {
    // Include if it's a selected variable
    if (selectedVariableIds.has(change.variableId)) {
      const variable = variables.find((v) => v.id === change.variableId);
      if (variable) {
        customData[variable.name] = change.value;
      }
    }

    // Include custom fields from data bubbles
    if (change.variableId.startsWith("__custom_field_")) {
      const keyMatch = change.variableId.match(/__custom_field_(.+)_/);
      if (keyMatch && keyMatch[1] && customFieldKeys.has(keyMatch[1])) {
        customData[keyMatch[1]] = change.value;
      }
    }
  });

  return customData;
};
