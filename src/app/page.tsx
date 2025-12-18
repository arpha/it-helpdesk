import { DarkmodeToggle } from "@/components/common/darkmode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  return (
    <div>
      <Input />
      <Button className="bg-red-400 dark:bg-amber-300">Hello</Button>
      <DarkmodeToggle />
    </div>
  );
}
