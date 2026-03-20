export type ParsedImageType = {
    buffer: Buffer;
    mimeType: string;
    extension: string;
  };

export type uploadAvatarType = {
    userId: string, 
    imageDataUrl: string
}