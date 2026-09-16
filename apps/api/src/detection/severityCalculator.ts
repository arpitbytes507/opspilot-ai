import { config } from '../config/env';

export type SeverityRuleName =
  | 'ERROR_BURST'
  | 'HIGH_SEVERITY_SINGLE_ERROR'
  | 'PERFORMANCE_DEGRADATION'
  | 'DEPLOYMENT_FAILURE';

export type SeverityContext = {
  rule: SeverityRuleName;
  eventCount?: number;
  environmentName?: string;
  production?: boolean;
};

const isProductionEnvironment = (environmentName?: string): boolean => {
  if (!environmentName) return false;
  return /^(production|prod)$/i.test(environmentName.trim());
};

export const calculateSeverity = ({ rule, eventCount = 0, environmentName, production }: SeverityContext): 'P1' | 'P2' | 'P3' | 'P4' => {
  const isProduction = production ?? isProductionEnvironment(environmentName);

  switch (rule) {
    case 'HIGH_SEVERITY_SINGLE_ERROR':
      return 'P1';
    case 'DEPLOYMENT_FAILURE':
      return isProduction ? 'P2' : 'P3';
    case 'ERROR_BURST':
      if (eventCount >= Math.max(config.errorBurstThreshold * 2, config.errorBurstThreshold + 5)) {
        return 'P1';
      }
      return isProduction ? 'P2' : 'P3';
    case 'PERFORMANCE_DEGRADATION':
      return isProduction ? 'P2' : 'P3';
    default:
      return 'P4';
  }
};
