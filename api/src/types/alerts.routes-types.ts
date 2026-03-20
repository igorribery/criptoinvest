export const ALLOWED_DIRECTION = ["ABOVE", "BELOW"] as const;
export const ALLOWED_ALERT_TYPE = ["PERIODIC", "TARGET_ONCE"] as const;
export const ALLOWED_PERIOD_HOURS = [4, 12, 24] as const;

export type AlertDirection = (typeof ALLOWED_DIRECTION)[number];
export type AlertType = (typeof ALLOWED_ALERT_TYPE)[number];
export type AlertPeriodHours = (typeof ALLOWED_PERIOD_HOURS)[number];

export type PriceAlertType = {

    id: string;
    user_id: string;
    symbol: string;
    alert_type: AlertType;
    direction: AlertDirection | null;
    target_price_brl: number | null;
    period_hours: AlertPeriodHours | null;
    notify_email: boolean;
    notify_sms: boolean;
    sms_phone_number: string | null;
    activated_price_brl: number | null;
    triggered_at: Date | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date | null;
  };

export type CreatePeriodicAlertType = {
  alertType: "PERIODIC";
  symbol?: string;
  periodHours?: AlertPeriodHours;
  notifyEmail?: boolean;
  notifySms?: boolean;
  smsPhoneNumber?: string;
};

export type CreateTargetOnceAlertType = {
  alertType: "TARGET_ONCE";
  symbol?: string;
  direction?: AlertDirection;
  targetPriceBrl?: number;
  notifyEmail?: boolean;
  notifySms?: boolean;
  smsPhoneNumber?: string;
};

export type CreateAlertType = CreatePeriodicAlertType | CreateTargetOnceAlertType;

  export type UpdateAlertType = {
    isActive?: boolean;
  };

