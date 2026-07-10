import { ParseFileOptions, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';

export const parseFileOptions: ParseFileOptions = {
  validators: [
    new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
  ],
};
