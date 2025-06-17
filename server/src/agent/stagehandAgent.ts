// src/agent/stagehandAgent.ts

import { chromium, ChromiumBrowser } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import { BookingDetails } from '../types/BookingRequest';
import * as dotenv from 'dotenv';

dotenv.config();

export class BrowserAgent {
  private stagehand: Stagehand | null = null;
  private browser: ChromiumBrowser | null = null;

  // Initialize the Playwright browser and Stagehand agent
  public async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: process.env.HEADLESS !== 'false',
        devtools: process.env.HEADLESS === 'false',
      });

      this.stagehand = new Stagehand({
        env: 'LOCAL',
        verbose: 2,
        domSettleTimeoutMs: 60000,
        enableCaching: true,
        modelName: 'gpt-4.1',
        modelClientOptions: {
          apiKey: process.env.OPENAI_API_KEY,
        },
        localBrowserLaunchOptions: {
          headless: process.env.HEADLESS !== 'false',
          devtools: process.env.HEADLESS === 'false',
        },
      });

      await this.stagehand.init();
      console.log('✅ BrowserAgent initialized');
    } catch (error) {
      console.error('❌ Failed to initialize BrowserAgent:', error);
      throw error;
    }
  }

  // Book an appointment using the platform-specific module
  public async bookAppointment(
    bookingDetails: BookingDetails,
    platformModule: any
  ): Promise<{ success: boolean; message: string }> {
    if (!this.stagehand) throw new Error('Stagehand not initialized');

    try {
      return await platformModule.bookAppointment(
        this.stagehand,
        bookingDetails
      );
    } catch (error) {
      console.error('❌ Booking failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Clean up browser and Stagehand instances
  public async close(): Promise<void> {
    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Safely expose Stagehand for external use (non-null guaranteed)
  public getStagehand(): Stagehand {
    if (!this.stagehand) {
      throw new Error('Stagehand has not been initialized yet.');
    }
    return this.stagehand;
  }
}
