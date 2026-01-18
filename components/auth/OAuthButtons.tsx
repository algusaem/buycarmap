import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { Button } from "@/components/ui/button";

export function OAuthButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button variant="outline" type="button" className="w-full">
        <FcGoogle className="mr-2 h-4 w-4" />
        Google
      </Button>
      <Button variant="outline" type="button" className="w-full">
        <FaGithub className="mr-2 h-4 w-4" />
        GitHub
      </Button>
    </div>
  );
}
