import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { automationAuthOutcome } from './policy';

@Injectable()
export class AutomationIngestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.AUTOMATION_INGEST_TOKEN;
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const result = automationAuthOutcome(request.headers.authorization, token);
    if (result === 'disabled') throw new NotFoundException('Automation ingestion is disabled');
    if (result === 'unauthorized') throw new UnauthorizedException('Invalid automation credential');
    return true;
  }
}
