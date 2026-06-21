export type ConfirmMode = 'two-step' | 'three-step';

export interface Config {
    confirmWaitingTime: number;
    confirmMode: ConfirmMode;
}
