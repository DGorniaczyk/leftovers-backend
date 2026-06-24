import { ApiProperty } from '@nestjs/swagger';

export class SendEmailResponse {
  @ApiProperty()
  status: string;
}
