import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class RequestPairingCodeDto {
  @ApiProperty({
    description: 'WhatsApp phone number in international format without symbols (e.g., 628123456789)',
    example: '628123456789',
  })
  @IsString()
  @Matches(/^\d{10,15}$/, {
    message: 'phoneNumber must be 10-15 digits (international format, no symbols)',
  })
  phoneNumber: string;

  @ApiPropertyOptional({
    description: 'Show a pairing notification on the target phone',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  showNotification?: boolean;
}
