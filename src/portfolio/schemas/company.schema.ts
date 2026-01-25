import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = Company & Document;

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true, unique: true })
  sourceKey: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  assetClass?: string;

  @Prop()
  industry?: string;

  @Prop()
  region?: string;

  @Prop()
  hq?: string;

  @Prop()
  website?: string;

  @Prop()
  year?: number;

  @Prop()
  logoUrl?: string;

  @Prop()
  sourceUrl: string;

  @Prop()
  updatedAt: Date;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
