export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'assigned' | 'in_progress' | 'waiting' | 'completed';
export type TaskStatus = 'open' | 'assigned' | 'in_progress' | 'waiting' | 'completed';

export interface Organization {
  id: string;
  name: string;
  industry: string;
  locations: string[];
  working_hours: string;
  escalation_rules: string;
  default_priority_rules: string;
  ai_instructions: string;
  created_at: string;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
  specialty: string;
  members: TeamMember[];
  color: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  available: boolean;
}

export interface Location {
  id: string;
  org_id: string;
  name: string;
  building?: string;
  floor?: string;
  zone?: string;
}

export interface Issue {
  id: string;
  org_id: string;
  title: string;
  source_message: string;
  category: string;
  location: string;
  priority: Priority;
  status: IssueStatus;
  created_at: string;
  updated_at: string;
  ai_analysis?: AIAnalysis;
  task_id?: string;
  created_by: string;
}

export interface Task {
  id: string;
  org_id: string;
  issue_id?: string;
  title: string;
  description: string;
  category: string;
  location: string;
  priority: Priority;
  status: TaskStatus;
  deadline?: string;
  assigned_team_id?: string;
  assigned_team_name?: string;
  assigned_member_id?: string;
  assigned_member_name?: string;
  ai_summary: string;
  ai_suggested_action: string;
  source_message: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface AIAnalysis {
  title: string;
  category: string;
  location: string;
  urgency: string;
  priority: Priority;
  deadline?: string;
  required_team: string;
  suggested_action: string;
  summary: string;
  missing_info: string[];
  confidence: number;
}

export interface AIAction {
  id: string;
  org_id: string;
  action_type: 'analyze_issue' | 'copilot_query' | 'suggestion_accepted' | 'suggestion_rejected';
  input: string;
  output: string;
  task_id?: string;
  issue_id?: string;
  created_at: string;
  created_by: string;
}

export interface ActivityLog {
  id: string;
  org_id: string;
  entity_type: 'issue' | 'task' | 'team' | 'settings';
  entity_id: string;
  action: string;
  details: string;
  created_at: string;
  created_by: string;
  created_by_name: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface DashboardStats {
  open_issues: number;
  critical_tasks: number;
  overdue_tasks: number;
  unassigned_tasks: number;
  tasks_today: number;
  teams_available: number;
}

export interface OrgSettings {
  company_name: string;
  industry: string;
  operating_locations: string;
  available_teams: string;
  working_hours: string;
  escalation_rules: string;
  default_priority_rules: string;
  ai_tone: string;
  ai_instructions: string;
}
