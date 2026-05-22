'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { Issue, Task, Team, ActivityLog, OrgSettings } from './types';
import { MOCK_ISSUES, MOCK_TASKS, MOCK_TEAMS, MOCK_ACTIVITY, MOCK_ORG_SETTINGS } from './mock-data';
import { generateId } from './utils';

interface AppState {
  issues: Issue[];
  tasks: Task[];
  teams: Team[];
  activity: ActivityLog[];
  settings: OrgSettings;
  currentUser: { name: string; email: string; role: string };
}

type Action =
  | { type: 'ADD_ISSUE'; payload: Issue }
  | { type: 'UPDATE_ISSUE'; payload: Partial<Issue> & { id: string } }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: string } }
  | { type: 'LOG_ACTIVITY'; payload: Omit<ActivityLog, 'id' | 'org_id' | 'created_by' | 'created_by_name'> }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<OrgSettings> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_ISSUE':
      return { ...state, issues: [action.payload, ...state.issues] };
    case 'UPDATE_ISSUE':
      return {
        ...state,
        issues: state.issues.map((i) =>
          i.id === action.payload.id ? { ...i, ...action.payload, updated_at: new Date().toISOString() } : i,
        ),
      };
    case 'ADD_TASK':
      return { ...state, tasks: [action.payload, ...state.tasks] };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload, updated_at: new Date().toISOString() } : t,
        ),
      };
    case 'LOG_ACTIVITY':
      return {
        ...state,
        activity: [
          {
            ...action.payload,
            id: generateId(),
            org_id: 'org-1',
            created_by: state.currentUser.email,
            created_by_name: state.currentUser.name,
          },
          ...state.activity,
        ],
      };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    default:
      return state;
  }
}

const initialState: AppState = {
  issues: MOCK_ISSUES,
  tasks: MOCK_TASKS,
  teams: MOCK_TEAMS,
  activity: MOCK_ACTIVITY,
  settings: MOCK_ORG_SETTINGS,
  currentUser: { name: 'Alex (Dispatcher)', email: 'dispatcher@meridian.io', role: 'Dispatcher' },
};

interface AppContextValue {
  state: AppState;
  addIssue: (issue: Omit<Issue, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'created_by'>) => Issue;
  addTask: (task: Omit<Task, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'created_by'>) => Task;
  updateTask: (id: string, update: Partial<Task>) => void;
  updateIssue: (id: string, update: Partial<Issue>) => void;
  updateSettings: (settings: Partial<OrgSettings>) => void;
  logActivity: (entry: Omit<ActivityLog, 'id' | 'org_id' | 'created_by' | 'created_by_name'>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addIssue = useCallback(
    (issue: Omit<Issue, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'created_by'>): Issue => {
      const full: Issue = {
        ...issue,
        id: `issue-${generateId()}`,
        org_id: 'org-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'dispatcher@meridian.io',
      };
      dispatch({ type: 'ADD_ISSUE', payload: full });
      dispatch({
        type: 'LOG_ACTIVITY',
        payload: {
          entity_type: 'issue',
          entity_id: full.id,
          action: 'created',
          details: `New issue created: ${full.title}`,
          created_at: new Date().toISOString(),
        },
      });
      return full;
    },
    [],
  );

  const addTask = useCallback(
    (task: Omit<Task, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'created_by'>): Task => {
      const full: Task = {
        ...task,
        id: `task-${generateId()}`,
        org_id: 'org-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'dispatcher@meridian.io',
      };
      dispatch({ type: 'ADD_TASK', payload: full });
      dispatch({
        type: 'LOG_ACTIVITY',
        payload: {
          entity_type: 'task',
          entity_id: full.id,
          action: 'created',
          details: `Task created: ${full.title}`,
          created_at: new Date().toISOString(),
        },
      });
      return full;
    },
    [],
  );

  const updateTask = useCallback((id: string, update: Partial<Task>) => {
    dispatch({ type: 'UPDATE_TASK', payload: { id, ...update } });
  }, []);

  const updateIssue = useCallback((id: string, update: Partial<Issue>) => {
    dispatch({ type: 'UPDATE_ISSUE', payload: { id, ...update } });
  }, []);

  const updateSettings = useCallback((settings: Partial<OrgSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  }, []);

  const logActivity = useCallback((entry: Omit<ActivityLog, 'id' | 'org_id' | 'created_by' | 'created_by_name'>) => {
    dispatch({ type: 'LOG_ACTIVITY', payload: entry });
  }, []);

  return (
    <AppContext.Provider value={{ state, addIssue, addTask, updateTask, updateIssue, updateSettings, logActivity }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
