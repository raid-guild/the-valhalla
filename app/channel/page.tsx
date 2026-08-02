import { ChannelWorkspace } from "./ChannelWorkspace";

type ChannelPageProps = {
  searchParams: Promise<{
    key?: string | string[];
  }>;
};

export default async function ChannelPage({ searchParams }: ChannelPageProps) {
  const params = await searchParams;
  const channelKey = typeof params.key === "string" ? params.key : "";

  return (
    <main className="valhalla-main">
      <ChannelWorkspace channelKey={channelKey} key={channelKey} />
    </main>
  );
}
