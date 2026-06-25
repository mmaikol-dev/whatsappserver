import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, IsUrl, ValidateIf, IsNumber, Min, Max } from 'class-validator';

export class SendTextMessageDto {
  @ApiProperty({
    description: 'WhatsApp chat ID (phone@c.us for individual, groupId@g.us for groups)',
    example: '628123456789@c.us',
  })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({
    description: 'Text message content',
    example: 'Hello from WaZuri!',
    maxLength: 4096,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text: string;

  @ApiPropertyOptional({
    description: 'Show typing indicator before sending message (in milliseconds). Default 1000-2000 random. Set to 0 to disable.',
    example: 2000,
    minimum: 0,
    maximum: 60000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60000)
  typingDuration?: number;
}

export class SendMediaMessageDto {
  @ApiProperty({
    description: 'WhatsApp chat ID',
    example: '628123456789@c.us',
  })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiPropertyOptional({
    description: 'Media URL (http/https)',
    example: 'https://example.com/image.jpg',
  })
  @IsOptional()
  @IsUrl()
  @ValidateIf((o: SendMediaMessageDto) => !o.base64)
  url?: string;

  @ApiPropertyOptional({
    description: 'Base64 encoded media data',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o: SendMediaMessageDto) => !o.url)
  base64?: string;

  @ApiPropertyOptional({
    description: 'Media MIME type (required when using base64)',
    example: 'image/jpeg',
  })
  @IsOptional()
  @IsString()
  mimetype?: string;

  @ApiPropertyOptional({
    description: 'Filename for the media',
    example: 'image.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @ApiPropertyOptional({
    description: 'Caption for the media',
    example: 'Check out this image!',
    maxLength: 1024,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;

  @ApiPropertyOptional({
    description: 'Show typing indicator before sending media (in milliseconds). Default 1500-3000 random. Set to 0 to disable.',
    example: 2000,
    minimum: 0,
    maximum: 60000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60000)
  typingDuration?: number;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'true_628123456789@c.us_3EB0123456789' })
  messageId: string;

  @ApiProperty({ example: 1706868000 })
  timestamp: number;
}
