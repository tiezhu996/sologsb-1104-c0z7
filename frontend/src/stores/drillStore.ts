import { create } from 'zustand'
import type { DrillSession } from '../types/drill'
import { db } from '../utils/db'
import { createId } from '../utils/id'

interface DrillState {
  sessions: DrillSession[]
  loading: boolean
  loadByJoint: (jointTypeId: string) => Promise<void>
  addSession: (session: Omit<DrillSession, 'id' | 'schemaRev'>) => Promise<DrillSession>
  removeSession: (sessionId: string) => Promise<void>
}

export const useDrillStore = create<DrillState>((set) => ({
  sessions: [],
  loading: false,

  loadByJoint: async (jointTypeId) => {
    set({ loading: true })
    try {
      const sessions = await db.drillSessions.where('jointTypeId').equals(jointTypeId).toArray()
      sessions.sort((a, b) => b.endedAt.localeCompare(a.endedAt))
      set({ sessions })
    } finally {
      set({ loading: false })
    }
  },

  addSession: async (session) => {
    const saved: DrillSession = { ...session, id: createId('drill'), schemaRev: 3 }
    await db.drillSessions.add(saved)
    set((state) => ({
      sessions: [saved, ...state.sessions].sort((a, b) => b.endedAt.localeCompare(a.endedAt)),
    }))
    return saved
  },

  removeSession: async (sessionId) => {
    await db.drillSessions.delete(sessionId)
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== sessionId),
    }))
  },
}))
