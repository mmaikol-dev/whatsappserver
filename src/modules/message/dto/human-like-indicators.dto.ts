import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

/**
 * DTO for sending read receipt (marking messages as seen)
 */
export class SendSeenDto {
  @ApiProperty({
    description: 'WhatsApp chat ID to mark as seen',
    example: '628123456789@c.us',
  })
  @IsString()
  @IsNotEmpty()
  chatId: string;
}

/**
 * DTO for sending typing indicator
 */
export class SendTypingIndicatorDto {
  @ApiProperty({
    description: 'WhatsApp chat ID where to show typing indicator',
    example: '628123456789@c.us',
  })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiPropertyOptional({
    description: 'How long to show typing indicator in milliseconds (default 3000, max 60000)',
    example: 3000,
    minimum: 0,
    maximum: 60000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60000)
  duration?: number;
}
