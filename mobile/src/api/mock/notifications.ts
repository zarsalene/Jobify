/**
 * SAMPLE notifications. Obviously fictional - used until push/server
 * notifications exist. Companies match the sample job feed.
 */
import type { NotificationType } from '@/state/preferences';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** expo-router path to open on tap. */
  route?: string;
}

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

export function sampleNotifications(): AppNotification[] {
  return [
    {
      id: 'n1',
      type: 'approvals',
      title: 'Your application to Medina Apps is ready for approval',
      body: 'Review the email and documents. Nothing is sent until you approve it.',
      createdAt: ago(1),
      read: false,
      route: '/approvals',
    },
    {
      id: 'n2',
      type: 'approvals',
      title: 'An approval is about to expire',
      body: 'You can still review it. If it lapses, nothing is sent and you can start again.',
      createdAt: ago(20),
      read: true,
      route: '/approvals',
    },
    {
      id: 'n3',
      type: 'applications',
      title: 'Application status updated',
      body: 'You moved an application to Interview. Good luck with the preparation.',
      createdAt: ago(5),
      read: false,
      route: '/applications',
    },
    {
      id: 'n4',
      type: 'matches',
      title: '3 new roles fit your CV',
      body: 'Based on your CV and search preferences. Take a look when you have a moment.',
      createdAt: ago(3),
      read: false,
      route: '/jobs',
    },
    {
      id: 'n5',
      type: 'reminders',
      title: 'Reminder: follow up on your application',
      body: 'You asked to be reminded. A short, polite message is usually enough.',
      createdAt: ago(30),
      read: true,
      route: '/applications',
    },
    {
      id: 'n6',
      type: 'system',
      title: 'Welcome to the sample build',
      body: 'Jobs, matches and drafts in this build are sample data. Nothing is sent to employers.',
      createdAt: ago(72),
      read: true,
      route: '/settings/privacy',
    },
  ];
}
