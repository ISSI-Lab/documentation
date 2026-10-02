import React from 'react';
import { OrganizationManagement } from '../organizations/OrganizationManagement';
import { Organization, User } from '../../types';

export interface TeamManagementProps {
  currentUser: User | null;
  teams?: Organization[];
  organizations?: Organization[];
  activeTeamId?: string | null;
  activeOrganizationId?: string | null;
  onSelectTeam?: (teamId: string) => void;
  onSelectOrganization?: (orgId: string) => void;
  onRefreshTeams?: () => Promise<void>;
  onRefreshOrganizations?: () => Promise<void>;
  onOpenAccountModal: () => void;
  onOpenNewDocModal: (projectId?: string) => void;
  onViewProjectDocs: (teamId: string, projectId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = (props) => {
  return (
    <OrganizationManagement
      currentUser={props.currentUser}
      organizations={props.organizations || props.teams}
      teams={props.teams}
      activeOrganizationId={props.activeOrganizationId || props.activeTeamId}
      activeTeamId={props.activeTeamId}
      onSelectOrganization={props.onSelectOrganization || props.onSelectTeam || (() => {})}
      onSelectTeam={props.onSelectTeam}
      onRefreshOrganizations={props.onRefreshOrganizations || props.onRefreshTeams || (async () => {})}
      onRefreshTeams={props.onRefreshTeams}
      onOpenAccountModal={props.onOpenAccountModal}
      onOpenNewDocModal={props.onOpenNewDocModal}
      onViewProjectDocs={props.onViewProjectDocs}
      showToast={props.showToast}
    />
  );
};

export default TeamManagement;
