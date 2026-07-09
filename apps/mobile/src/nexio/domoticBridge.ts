/**
 * Nexio Domotic Bridge — Connects ESP32/Zigbee sensors to the AI runtime.
 * In box mode, listens for sensor events and feeds them to the LLM for analysis.
 */

export interface SensorEvent {
  id: string;
  deviceId: string;
  type: SecurityEventType;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  source: string;  // sensor name
  value?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export enum SecurityEventType {
  MOTION_DETECTED = 'motion_detected',
  DOOR_OPENED = 'door_opened',
  DOOR_FORCED = 'door_forced',
  WINDOW_BROKEN = 'window_broken',
  SMOKE_DETECTED = 'smoke_detected',
  WATER_LEAK = 'water_leak',
  INTRUSION = 'intrusion',
  TAMPER = 'tamper',
  POWER_OUTAGE = 'power_outage',
  POWER_RESTORED = 'power_restored',
  CAMERA_MOTION = 'camera_motion',
  UNKNOWN_FACE = 'unknown_face',
  LOW_BATTERY = 'low_battery',
  CONNECTIVITY_LOST = 'connectivity_lost',
  CONNECTIVITY_RESTORED = 'connectivity_restored',
}

/**
 * Event listeners
 */
type EventCallback = (event: SensorEvent) => void;
const listeners: EventCallback[] = [];

export function onSensorEvent(callback: EventCallback): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function emit(event: SensorEvent): void {
  for (const cb of listeners) {
    try { cb(event); } catch (e) { console.error('[DomoticBridge] Listener error:', e); }
  }
}

/**
 * ESP32 Bridge — Connects to the ESP32 gateway via local HTTP/WebSocket.
 * The ESP32 exposes a REST API on the local network for sensor data.
 */
export class ESP32Bridge {
  private baseUrl: string;
  private polling: ReturnType<typeof setInterval> | null = null;
  private lastEventId: string | null = null;
  
  constructor(esp32Ip: string = '192.168.4.1', port: number = 80) {
    this.baseUrl = `http://${esp32Ip}:${port}`;
  }
  
  /**
 * Start polling the ESP32 for sensor events.
 */
  start(intervalMs: number = 2000): void {
    this.polling = setInterval(async () => {
      try {
        const events = await this.fetchEvents();
        for (const event of events) {
          emit(event);
        }
      } catch (error) {
        console.warn('[ESP32Bridge] Poll error:', error);
      }
    }, intervalMs);
    console.log('[ESP32Bridge] Started polling:', this.baseUrl);
  }
  
  /**
 * Stop polling.
 */
  stop(): void {
    if (this.polling) {
      clearInterval(this.polling);
      this.polling = null;
    }
  }
  
  /**
 * Fetch new events from ESP32.
 */
  private async fetchEvents(): Promise<SensorEvent[]> {
    const url = this.lastEventId
      ? `${this.baseUrl}/api/events?after=${this.lastEventId}`
      : `${this.baseUrl}/api/events?limit=10`;
    
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    const events: SensorEvent[] = data.events || [];
    
    if (events.length > 0) {
      this.lastEventId = events[events.length - 1].id;
    }
    
    return events;
  }
  
  /**
 * Send a command to the ESP32 (e.g., trigger siren, arm/disarm).
 */
  async sendCommand(command: string, params?: Record<string, any>): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, ...params }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Format sensor events into a context string for the LLM.
 */
export function formatEventsForLLM(events: SensorEvent[]): string {
  if (events.length === 0) return 'Aucun événement de sécurité récent.';
  
  const lines = events.map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const severity = {
      info: 'INFO',
      low: 'BAS',
      medium: 'MOYEN',
      high: 'HAUT',
      critical: 'CRITIQUE',
    }[e.severity];
    
    return `[${time}] ${severity} — ${e.type} — ${e.source}${e.value !== undefined ? ` (${e.value})` : ''}`;
  });
  
  return `Événements de sécurité récents:\n${lines.join('\n')}`;
}
