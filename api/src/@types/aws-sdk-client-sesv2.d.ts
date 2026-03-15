declare module "@aws-sdk/client-sesv2" {
  export class SESv2Client {
    constructor(config: { region?: string });
    send(command: SendEmailCommand): Promise<unknown>;
  }

  export class SendEmailCommand {
    constructor(input: {
      FromEmailAddress?: string;
      Destination?: {
        ToAddresses?: string[];
      };
      Content?: {
        Simple?: {
          Subject?: {
            Charset?: string;
            Data?: string;
          };
          Body?: {
            Text?: {
              Charset?: string;
              Data?: string;
            };
            Html?: {
              Charset?: string;
              Data?: string;
            };
          };
        };
      };
    });
  }
}
