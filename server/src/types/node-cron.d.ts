declare module "node-cron" {
  export function schedule(
    expression: string,
    func: () => void,
    options?: unknown
  ): unknown;
}
