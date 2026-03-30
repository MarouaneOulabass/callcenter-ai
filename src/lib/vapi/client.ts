interface VapiAssistantConfig {
  name: string;
  firstMessage: string;
  model: {
    provider: string;
    model: string;
    systemPrompt: string;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  serverUrl: string;
}

export class VapiClient {
  private apiKey: string;
  private baseUrl = 'https://api.vapi.ai';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createAssistant(config: VapiAssistantConfig) {
    const response = await fetch(`${this.baseUrl}/assistant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.name,
        firstMessage: config.firstMessage,
        model: config.model,
        voice: config.voice,
        serverUrl: config.serverUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vapi error: ${response.statusText}`);
    }

    return response.json();
  }

  async updateAssistant(assistantId: string, updates: Partial<VapiAssistantConfig>) {
    const response = await fetch(`${this.baseUrl}/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Vapi error: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteAssistant(assistantId: string) {
    const response = await fetch(`${this.baseUrl}/assistant/${assistantId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Vapi error: ${response.statusText}`);
    }
  }
}
