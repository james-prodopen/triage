'use client';

import { Settings, Activity, Users, RefreshCw } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

type Section = 'configuration' | 'code-health' | 'team-health';

interface AppSidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  onRefresh: () => void;
  isLoading: boolean;
  isConfigurationComplete: boolean;
}

export function AppSidebar({ activeSection, onSectionChange, onRefresh, isLoading, isConfigurationComplete }: AppSidebarProps) {
  const sections = [
    {
      id: 'configuration' as Section,
      label: 'Configuration',
      icon: Settings,
    },
    {
      id: 'code-health' as Section,
      label: 'Code health',
      icon: Activity,
    },
    {
      id: 'team-health' as Section,
      label: 'Team health',
      icon: Users,
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <h1 className="text-xl font-bold">Triage</h1>
        {isConfigurationComplete && (
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            className="w-full mt-4"
            variant="default"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh data'}
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {sections.map((section) => (
              <SidebarMenuItem key={section.id}>
                <SidebarMenuButton
                  onClick={() => onSectionChange(section.id)}
                  data-active={activeSection === section.id}
                  className="w-full"
                >
                  <section.icon className="mr-2 h-4 w-4" />
                  {section.label}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
