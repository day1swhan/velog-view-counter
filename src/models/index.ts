export type SessionId = {
  sid: string;
};
export type UserAgent = {
  userAgent: string;
};

export type PageView = SessionId & UserAgent & { date: string };

export type PageViewInfo = {
  id: string;
  pageCount: number;
  page: {
    has_more: boolean;
    next_cursor?: string;
  };
  lastUpdate: string;
};

export type SessionInfo = PageViewInfo & {
  data: SessionId[];
};

export type SessionDetail = { id: string } & PageView;
