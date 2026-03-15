export const ALLOWED_DIRECTION = ["ABOVE", "BELOW"] as const;
export const ALLOWED_FREQUENCY = ["5m", "15m", "1h", "1d"] as const;

export type AlertDirection = (typeof ALLOWED_DIRECTION)[number];
export type AlertFrequency = (typeof ALLOWED_FREQUENCY)[number];

export type PriceAlertType = {

    id: string;
    user_id: string;
    symbol: string;
    direction: AlertDirection;
    target_price_brl: number;
    frequency: AlertFrequency;
    is_active: boolean;
    created_at: Date;
    updated_at: Date | null;
  };

  export type CreateAlertType = {
    symbol?: string;
    direction?: AlertDirection;
    targetPriceBrl?: number;
    frequency?: AlertFrequency;
  };

  export type UpdateAlertType = {
    isActive?: boolean;
  };

