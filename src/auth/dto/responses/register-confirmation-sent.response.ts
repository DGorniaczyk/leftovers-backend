export class RegisterConfirmationSentResponse {
  message: string;

  static from(result: { message: string }): RegisterConfirmationSentResponse {
    return { message: result.message };
  }
}
