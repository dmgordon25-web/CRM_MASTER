import { describe, expect, it } from 'vitest';
import { deriveBaselineSnapshot } from '../../crm-app/js/dashboard/baseline_snapshot.js';

const FIXED_NOW = new Date('2025-05-10T12:00:00Z');
const startOfDayUtc = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

function makeContact(overrides) {
  return Object.assign({
    id: 'contact',
    name: 'Contact',
    lane: 'application',
    stage: 'application',
    createdTs: Date.parse('2025-05-01T00:00:00Z'),
    fundedTs: null,
    loanAmount: 0,
    partners: [],
    stageMap: { application: Date.parse('2025-05-01T00:00:00Z') },
    deleted: false
  }, overrides);
}

describe('deriveBaselineSnapshot', () => {
  it('returns consistent KPI and pipeline metrics', () => {
    const contacts = [
      makeContact({
        id: 'c1',
        name: 'Alice',
        lane: 'application',
        stage: 'application',
        createdTs: Date.parse('2025-05-01T00:00:00Z'),
        stageMap: { application: Date.parse('2025-04-20T00:00:00Z') },
        partners: ['p1'],
        loanAmount: 250000
      }),
      makeContact({
        id: 'c2',
        name: 'Bob',
        lane: 'preapproved',
        stage: 'preapproved',
        createdTs: Date.parse('2025-05-08T00:00:00Z'),
        stageMap: { preapproved: Date.parse('2025-05-08T00:00:00Z') },
        partners: ['p1']
      }),
      makeContact({
        id: 'c3',
        name: 'Carla',
        lane: 'cleared-to-close',
        stage: 'cleared-to-close',
        createdTs: Date.parse('2025-04-10T00:00:00Z'),
        fundedTs: Date.parse('2025-05-02T00:00:00Z'),
        loanAmount: 300000,
        stageMap: {
          'cleared-to-close': Date.parse('2025-04-25T00:00:00Z'),
          application: Date.parse('2025-04-15T00:00:00Z')
        },
        partners: ['p2']
      }),
      makeContact({
        id: 'c4',
        name: 'Dana',
        lane: 'lost',
        stage: 'lost',
        createdTs: Date.parse('2025-04-15T00:00:00Z'),
        partners: ['p1']
      })
    ];

    const tasks = [
      {
        id: 't1',
        contactId: 'c1',
        title: 'Review docs',
        due: new Date('2025-05-10T15:00:00Z'),
        dueTs: Date.parse('2025-05-10T15:00:00Z'),
        raw: {}
      },
      {
        id: 't2',
        contactId: 'c2',
        title: 'Follow up',
        due: new Date('2025-05-09T12:00:00Z'),
        dueTs: Date.parse('2025-05-09T12:00:00Z'),
        raw: {}
      }
    ];

    const allTasks = tasks.concat({
      id: 't3',
      contactId: 'c1',
      title: 'Consult call',
      due: new Date('2025-05-11T16:00:00Z'),
      dueTs: Date.parse('2025-05-11T16:00:00Z'),
      raw: { type: 'Appointment' }
    });

    const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
    const partnerMap = new Map([
      ['p1', { id: 'p1', name: 'Partner One', tier: 'Gold' }],
      ['p2', { id: 'p2', name: 'Partner Two', tier: 'Silver' }]
    ]);

    const snapshot = deriveBaselineSnapshot({
      contacts,
      visibleTasks: tasks,
      allTasks,
      contactById: (id) => contactMap.get(id),
      partnerById: (id) => partnerMap.get(id),
      pipelineLaneOrder: ['long-shot', 'application', 'preapproved', 'cleared-to-close'],
      pipelineActiveLanes: ['long-shot', 'application', 'preapproved', 'cleared-to-close'],
      partnerNoneId: 'none',
      canonicalStage: (value) => String(value || '').toLowerCase(),
      laneKeyFromStage: (value) => String(value || '').toLowerCase(),
      now: FIXED_NOW,
      startOfDay: startOfDayUtc
    });

    expect(snapshot.pipelineCounts.application).toBe(1);
    expect(snapshot.pipelineCounts['preapproved']).toBe(1);
    expect(snapshot.pipelineCounts['cleared-to-close']).toBe(1);
    expect(snapshot.pipelineCounts.lost).toBe(1);

    expect(snapshot.kpis.kpiNewLeads7d).toBe(1);
    expect(snapshot.kpis.kpiActivePipeline).toBe(3);
    expect(snapshot.kpis.kpiFundedYTD).toBe(1);
    expect(snapshot.kpis.kpiFundedVolumeYTD).toBe(300000);
    expect(Math.round(snapshot.kpis.kpiAvgCycleLeadToFunded)).toBeGreaterThanOrEqual(7);
    expect(snapshot.kpis.kpiTasksToday).toBe(1);
    expect(snapshot.kpis.kpiTasksOverdue).toBe(1);
    expect(snapshot.kpis.kpiReferralsYTD).toBe(1);

    expect(snapshot.focus.tasksToday).toHaveLength(1);
    expect(snapshot.focus.nextAppointments.map((task) => task.title)).toContain('Consult call');
    expect(snapshot.focus.recentLeads.length).toBeGreaterThan(0);

    expect(snapshot.dueGroups.today).toHaveLength(1);
    expect(snapshot.dueGroups.overdue).toHaveLength(1);

    const leaderboardEntryP2 = snapshot.leaderboard.find((entry) => entry.id === 'p2');
    expect(leaderboardEntryP2).toBeTruthy();
    expect(leaderboardEntryP2.fundedCount).toBe(1);
    expect(leaderboardEntryP2.activeCount).toBe(1);
    expect(leaderboardEntryP2.volume).toBe(300000);

    const staleContactIds = snapshot.staleDeals.map((entry) => entry.contact.id);
    expect(staleContactIds).toContain('c1');
  });
});
