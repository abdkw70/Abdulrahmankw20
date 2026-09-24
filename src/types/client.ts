export type Language = 'ar' | 'en';

export type OperatingMode = 'unrestricted' | 'medium' | 'cautious';
export type AutonomyLevel = OperatingMode | 'strict' | 'semi_supervised' | 'autonomous';

export type AgentStatus =
  | 'idle'
  | 'planning'
  | 'researching'
  | 'executing'
  | 'verifying'
  | 'debugging'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'aborted'
  // Granular live execution statuses
  | 'researching_websites'
  | 'checking_docs'
  | 'reading_repo'
  | 'validating_scope'
  | 'reviewing_alerts'
  | 'running_scan'
  | 'editing_files'
  | 'running_tests'
  | 'fixing_error'
  | 'creating_commit'
  | 'creating_pr';

export type ToolName =
  | 'terminal_execute'
  | 'file_write'
  | 'file_read'
  | 'file_delete'
  | 'file_list'
  | 'code_execute'
  | 'web_search'
  | 'github_inspect'
  | 'security_audit'
  | 'poc_runner'
  | 'git_operation'
  | 'github_sync'
  | 'dependency_scan'
  | 'secret_scan'
  | 'container_scan'
  | 'sbom_generate'
  | 'tls_header_audit';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecurityAlertSeverity = 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityAlert {
  id: string;
  severity: SecurityAlertSeverity;
  type:
    | 'secret_leak'
    | 'data_loss'
    | 'destructive_command'
    | 'unauthorized_access'
    | 'vulnerability'
    | 'config_risk'
    | 'external_transmission';
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  resource: string;
  evidence?: string;
  suggestedFix?: string;
  canBypass: boolean;
  bypassed: boolean;
  bypassReason?: string;
  bypassedBy?: string;
  timestamp: string;
}

export interface DiscoveredSecurityTool {
  siteName: string;
  toolName: string;
  toolType:
    | 'SAST'
    | 'DAST'
    | 'Secret Scanner'
    | 'Dependency Scanner'
    | 'Container Scanner'
    | 'Cloud Auditor'
    | 'IaC Scanner'
    | 'SBOM'
    | 'TLS/Headers'
    | 'Documentation';
  purpose: string;
  posture: 'DEFENSIVE' | 'OFFENSIVE';
  authRequired: boolean;
  scopePermitted: boolean;
  termsOfService: string;
  potentialRisks: string;
  safeUsageInScope: string;
  url: string;
}

export interface OwnerPolicy {
  operatingMode: OperatingMode;
  autonomyLevel: AutonomyLevel;
  allowNonCriticalAlertBypassAfterReview: boolean;
  authorizedScopes: {
    repositories: string[];
    domains: string[];
    paths: string[];
  };
  terminal: {
    enabled: boolean;
    requireApproval: boolean;
    disallowedCommands: string[];
    timeoutSeconds: number;
  };
  filesystem: {
    writeEnabled: boolean;
    deleteEnabled: boolean;
    requireApprovalForDelete: boolean;
    requireApprovalForOverwrite: boolean;
  };
  network: {
    enabled: boolean;
    requireApprovalForOutbound: boolean;
    allowedDomains: string[];
  };
  codeExecution: {
    enabled: boolean;
    requireApproval: boolean;
    timeoutSeconds: number;
    maxOutputLength: number;
  };
  securityLab: {
    enabled: boolean;
    allowPocExecution: boolean;
    isolatedLabOnly: boolean;
  };
  git: {
    enabled: boolean;
    requireApprovalForPushOrCommit: boolean;
  };
}

export interface PlanStep {
  id: string;
  phase: 'UNDERSTAND' | 'RESEARCH' | 'CODE' | 'EXECUTE' | 'TEST' | 'DEBUG' | 'SECURITY' | 'VERIFY' | 'DOCUMENT';
  title: string;
  titleAr?: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  toolUsed?: ToolName;
  resultSummary?: string;
  evidence?: string;
}

export interface PendingApproval {
  id: string;
  tool: ToolName;
  params: any;
  riskLevel: RiskLevel;
  explanation: string;
  explanationAr: string;
  timestamp: string;
  // Enhanced 11 fields for "بحذر" mode:
  operation?: string;
  targetWebsiteOrRepo?: string;
  scanScope?: string;
  affectedFiles?: string[];
  commandToRun?: string;
  expectedNetworkRequests?: string[];
  reason?: string;
  expectedImpact?: string;
  potentialRisks?: string;
  requiredPermissions?: string[];
  dataToSend?: string;
  privacyPolicyUrl?: string;
}

export interface AgentMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  phase?: string;
  toolCall?: {
    tool: ToolName;
    params: any;
    output?: any;
    error?: string;
    riskLevel?: RiskLevel;
  };
  plan?: PlanStep[];
  status?: AgentStatus;
  alerts?: SecurityAlert[];
  discoveredTools?: DiscoveredSecurityTool[];
}

export interface WorkspaceItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
}

export interface VulnerabilityFinding {
  id: string;
  cwe: string;
  title: string;
  severity: RiskLevel;
  file: string;
  line: number;
  snippet: string;
  description: string;
  descriptionAr: string;
  impact: string;
  remediation: string;
  remediationAr: string;
}

export interface SecurityAuditReport {
  timestamp: string;
  workspaceId: string;
  filesScanned: number;
  findings: VulnerabilityFinding[];
  alerts?: SecurityAlert[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  securityScore: number;
  sbom?: any;
  containerChecks?: any[];
  dependencyChecks?: any[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  mode: OperatingMode;
  workspaceId: string;
  repository?: string;
  branch?: string;
  targetWebsite?: string;
  authorizedScope?: string;
  tool: ToolName | 'system' | 'owner' | 'security_scanner' | 'github_service';
  action: string;
  command?: string;
  filesChanged?: string[];
  networkRequest?: {
    url: string;
    method: string;
    host: string;
  };
  dataSent?: {
    destination: string;
    summary: string;
    sizeBytes?: number;
  };
  securityAlert?: string;
  alertOverride?: {
    alertId: string;
    reason: string;
    user: string;
  };
  approval?: {
    required: boolean;
    granted: boolean;
    user?: string;
  };
  resultSummary: string;
  result?: string;
  error?: string;
  commitSha?: string;
  success: boolean;
  riskLevel: RiskLevel;
  diff?: string;
  executionTimeMs?: number;
  params?: any;
}
