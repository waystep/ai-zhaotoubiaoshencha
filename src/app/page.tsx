import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session) {
    redirect("/projects");
  }
  redirect("/login");
}
