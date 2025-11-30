import { Menu } from "@base-ui-components/react/menu";

interface OptionsDropdownProps {
  githubUrl?: string;
  twitterUrl?: string;
  npmUrl?: string;
}

export default function OptionsDropdown({
  githubUrl = "https://github.com/cristicretu/hive",
  twitterUrl = "https://x.com/cristicrtu",
  npmUrl = "https://www.npmjs.com/package/@cristicretu/hive-cli",
}: OptionsDropdownProps) {
  const handleCopyMarkdown = async () => {
    const markdown = await fetch("/llms.txt").then((r) => r.text());
    await navigator.clipboard.writeText(markdown);
  };

  const handleViewMarkdown = () => {
    window.open("/llms.txt", "_blank");
  };

  const handleOpenInAI = (service: string) => {
    const prompt = encodeURIComponent("Read https://hive.cretu.dev/llms.txt. I want to ask questions about it.");
    const urls: Record<string, string> = {
      chatgpt: `https://chat.openai.com?hints=search&prompt=${prompt}`,
      claude: `https://claude.ai/new?q=${prompt}`,
    };
    window.open(urls[service], "_blank");
  };

  return (
    <Menu.Root>
      <Menu.Trigger className="p-2 hover:bg-gray-100 rotate-90 rounded-md transition-colors cursor-pointer">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="8" cy="3" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8}>
          <Menu.Popup className="dropdown-popup text-sm p-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[180px]">
            {/* Links section */}
            <Menu.Item
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors rounded-lg"
              onClick={() => window.open(githubUrl, "_blank")}
            >
              Github
            </Menu.Item>
            <Menu.Item
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors rounded-lg"
              onClick={() => window.open(twitterUrl, "_blank")}
            >
              X (Twitter)
            </Menu.Item>
            <Menu.Item
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors rounded-lg"
              onClick={() => window.open(npmUrl, "_blank")}
            >
              NPM
            </Menu.Item>

            <Menu.Separator className="my-2 h-px bg-gray-200" />

            {/* Markdown section */}
            <Menu.Item
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors rounded-lg"
              onClick={handleCopyMarkdown}
            >
              Copy Markdown
            </Menu.Item>
            <Menu.Item
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors rounded-lg"
              onClick={handleViewMarkdown}
            >
              View as Markdown
            </Menu.Item>

            <Menu.Separator className="my-2 h-px bg-gray-200" />

            {/* AI services section */}
            <Menu.Item
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors rounded-lg"
              onClick={() => handleOpenInAI("chatgpt")}
            >
              Open in ChatGPT
            </Menu.Item>
            <Menu.Item
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors rounded-lg"
              onClick={() => handleOpenInAI("claude")}
            >
              Open in Claude
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
