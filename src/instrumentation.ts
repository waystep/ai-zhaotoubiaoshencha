export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { cronManager } = await import("@/lib/tasks/cron-manager");
    cronManager.start();
    console.log("[Instrumentation] CronManager 已启动");
  }
}
