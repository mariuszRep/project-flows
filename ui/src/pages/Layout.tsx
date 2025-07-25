import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MultiSelectDropdown from "@/components/ui/multi-select-dropdown";
import type { Option } from "@/components/ui/multi-select-dropdown";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { HeaderLayout } from "@/components/layout/HeaderLayout";
import { useNavigate } from "react-router-dom";

export default function Layout() {
  const { toast } = useToast();
  const navigate = useNavigate();


  return (
    <HeaderLayout>
      <div>
        <div className="mx-auto text-center">
          <h1 className="text-3xl font-bold mb-8">UI Component Library</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            {/* Alert Component */}
            <ComponentCard
          title="Alert"
          description="Displays a callout for user attention with optional title and description."
        >
          <Alert className="mb-4">
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This is an informational alert to notify users.
            </AlertDescription>
          </Alert>
          
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              This is a destructive alert for critical warnings.
            </AlertDescription>
          </Alert>
        </ComponentCard>

        {/* Button Component */}
        <ComponentCard
          title="Button"
          description="Interactive button element with various styles and sizes."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="default">Default</Button>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="default">Default Size</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </ComponentCard>

        {/* Card Component */}
        <ComponentCard
          title="Card"
          description="Container for grouping related content with header, content, and footer sections."
        >
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description text</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This is the main content area of the card.</p>
            </CardContent>
            <CardFooter>
              <Button>Action</Button>
            </CardFooter>
          </Card>
        </ComponentCard>

        {/* Dropdown Menu Component */}
        <ComponentCard
          title="Dropdown Menu"
          description="Displays a menu of options triggered by a button click."
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Open Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ComponentCard>

        {/* Input Component */}
        <ComponentCard
          title="Input"
          description="Basic input field for collecting user data."
        >
          <div className="space-y-4">
            <Input placeholder="Default input" />
            <Input placeholder="Disabled input" disabled />
          </div>
        </ComponentCard>

        {/* Label Component */}
        <ComponentCard
          title="Label"
          description="Text label for form controls."
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Enter your name" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" placeholder="Enter your email" className="mt-1" />
            </div>
          </div>
        </ComponentCard>

        {/* Progress Component */}
        <ComponentCard
          title="Progress"
          description="Displays completion progress for a task or operation."
        >
          <div className="space-y-4">
            <Progress value={25} className="w-full" />
            <Progress value={50} className="w-full" />
            <Progress value={75} className="w-full" />
            <Progress value={100} className="w-full" />
          </div>
        </ComponentCard>

        {/* Textarea Component */}
        <ComponentCard
          title="Textarea"
          description="Multi-line text input field."
        >
          <Textarea placeholder="Type your message here." />
        </ComponentCard>

        {/* Theme Toggle Component removed */}

        {/* Toast Component */}
        <ComponentCard
          title="Toast"
          description="Temporary notification that appears at the edge of the screen."
        >
          <Button
            onClick={() =>
              toast({
                title: "Toast Notification",
                description: "This is a toast message example.",
              })
            }
          >
            Show Toast
          </Button>
          <Toaster />
        </ComponentCard>

        {/* Tooltip Component */}
        <ComponentCard
          title="Tooltip"
          description="Displays additional information on hover."
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover Me</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ComponentCard>

        {/* MultiSelectDropdown Component */}
        <ComponentCard
          title="MultiSelectDropdown"
          description="A dropdown that allows selecting multiple options with tags."
        >
          <MultiSelectDropdownDemo />
            </ComponentCard>
          </div>
        </div>
      </div>
    </HeaderLayout>
  );
}

// Helper component for consistent card styling
function ComponentCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-[var(--radius-m)] p-6 bg-background">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div className="p-4 border rounded-[var(--radius-m)] bg-surface">{children}</div>
    </div>
  );
}

// Demo component for MultiSelectDropdown
function MultiSelectDropdownDemo() {
  const options: Option[] = [
    { id: 1, label: 'React' },
    { id: 2, label: 'Vue' },
    { id: 3, label: 'Angular' },
    { id: 4, label: 'Svelte' },
    { id: 5, label: 'Next.js' },
  ];
  
  const [selected, setSelected] = useState<Option[]>([]);
  
  return (
    <MultiSelectDropdown
      options={options}
      selectedOptions={selected}
      onChange={setSelected}
      placeholder="Select frameworks"
    />
  );
}
