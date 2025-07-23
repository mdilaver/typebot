import { AudioBubbleForm } from "@/features/blocks/bubbles/audio/components/AudioBubbleForm";
import { DataBubbleForm } from "@/features/blocks/bubbles/data/components/DataBubbleForm";
import { EmbedUploadContent } from "@/features/blocks/bubbles/embed/components/EmbedUploadContent";
import { ImageBubbleSettings } from "@/features/blocks/bubbles/image/components/ImageBubbleSettings";
import { VideoUploadContent } from "@/features/blocks/bubbles/video/components/VideoUploadContent";
import type { FilePathUploadProps } from "@/features/upload/api/generateUploadUrl";
import {
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  Portal,
} from "@chakra-ui/react";
import { BubbleBlockType } from "@typebot.io/blocks-bubbles/constants";
import type {
  BubbleBlock,
  BubbleBlockContent,
} from "@typebot.io/blocks-bubbles/schema";
import type { TextBubbleBlock } from "@typebot.io/blocks-bubbles/text/schema";
import { useRef } from "react";

type Props = {
  uploadFileProps: FilePathUploadProps;
  block: Exclude<BubbleBlock, TextBubbleBlock>;
  onContentChange: (content: BubbleBlockContent) => void;
};

export const MediaBubblePopoverContent = (props: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <Portal>
      <PopoverContent onMouseDown={(e) => e.stopPropagation()}>
        <PopoverArrow />
        <PopoverBody
          pt="6"
          pb="6"
          px="4"
          ref={ref}
          style={{
            minHeight: "400px",
            maxHeight: "400px",
            overflow: "auto",
          }}
        >
          <MediaBubbleContent {...props} />
        </PopoverBody>
      </PopoverContent>
    </Portal>
  );
};

export const MediaBubbleContent = ({
  uploadFileProps,
  block,
  onContentChange,
}: Props) => {
  switch (block.type) {
    case BubbleBlockType.IMAGE: {
      return (
        <ImageBubbleSettings
          uploadFileProps={uploadFileProps}
          block={block}
          onContentChange={onContentChange}
        />
      );
    }
    case BubbleBlockType.VIDEO: {
      return (
        <VideoUploadContent
          content={block.content}
          onSubmit={onContentChange}
        />
      );
    }
    case BubbleBlockType.EMBED: {
      return (
        <EmbedUploadContent
          content={block.content}
          onSubmit={onContentChange}
        />
      );
    }
    case BubbleBlockType.AUDIO: {
      return (
        <AudioBubbleForm
          content={block.content}
          uploadFileProps={uploadFileProps}
          onContentChange={onContentChange}
        />
      );
    }
    case BubbleBlockType.DATA: {
      return <DataBubbleForm block={block} onContentChange={onContentChange} />;
    }
  }
};
