import type { BookmarkedIdea, Idea, IdeaMode, TrendTopic } from '../domain/types';
import { bookmarkKey } from '../domain/bookmarks';
import { modeLabel } from '../domain/ideas';

interface SelectedIdeaDetailProps {
  trend: TrendTopic;
  idea: Idea;
  mode: IdeaMode;
  bookmarks: BookmarkedIdea[];
  onCopyPrompt: () => void;
  onToggleBookmark: () => void;
  onOpenBookmark: (trendId: string, mode: IdeaMode) => void;
  onRemoveBookmark: (key: string) => void;
}

export default function SelectedIdeaDetail({ trend, idea, mode, bookmarks, onCopyPrompt, onToggleBookmark, onOpenBookmark, onRemoveBookmark }: SelectedIdeaDetailProps) {
  const bookmarked = bookmarks.some((item) => item.key === bookmarkKey(trend.id, mode));

  return (
    <section className="detail-card" id="selectedIdeaDetail">
      <div className="label-row"><span className="badge violet">Selected Idea Detail</span><span className="badge">{modeLabel(mode)}</span><span className="badge orange">찜한 기획안 {bookmarks.length}건</span></div>
      <div className="selected-detail">
        <div>
          <h3>{idea.title}</h3>
          <p className="muted">{idea.concept}</p>
          <div className="idea-meta" style={{ marginTop: 14 }}>
            <div className="meta-row"><span>기획 목적</span><strong>{idea.expectedEffect}</strong></div>
            <div className="meta-row"><span>타깃 고객</span><strong>{idea.target}</strong></div>
            <div className="meta-row"><span>카테고리</span><strong>{idea.category}</strong></div>
            <div className="meta-row"><span>혜택 구조</span><strong>{idea.benefit}</strong></div>
            <div className="meta-row"><span>협업 부서</span><strong>{idea.teams.join(' · ')}</strong></div>
            <div className="meta-row"><span>리스크</span><strong>{idea.risk}</strong></div>
          </div>
          <div className="idea-actions">
            <button className="btn blue" type="button" onClick={onCopyPrompt}>기획안 구체화 프롬프트 복사</button>
            <button className={`btn ${bookmarked ? 'active' : ''}`} type="button" onClick={onToggleBookmark}>{bookmarked ? '찜 해제' : '이 기획안 찜하기'}</button>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>찜하기는 MVP에서 브라우저 localStorage에 저장됩니다. 실제 개발 버전에서는 로그인한 개인 계정의 북마크/찜 목록으로 저장해 한 번에 모아보는 기능으로 확장합니다.</p>
        </div>
        <div>
          <h4>메시지/카피 초안</h4>
          <div className="copy-box">
            <div className="copy-line"><span>배너</span><strong>{idea.copy.banner}</strong></div>
            <div className="copy-line"><span>앱푸시</span><strong>{idea.copy.push}</strong></div>
            <div className="copy-line"><span>라이브</span><strong>{idea.copy.live}</strong></div>
          </div>
          <h4 style={{ marginTop: 18 }}>실행 체크리스트</h4>
          <ul className="clean">{idea.checklist.map((item) => <li key={item}>{item}</li>)}</ul>
          <h4 style={{ marginTop: 18 }}>다음 액션</h4>
          <ul className="clean">
            <li>근거 링크를 실제 원천으로 교체하고 수치 정의를 확정합니다.</li>
            <li>MD/CRM/콘텐츠 담당자와 실행 가능성을 1차 검토합니다.</li>
            <li>선택안 기준으로 혜택 예산과 예상 성과 가설을 추가합니다.</li>
          </ul>
          <h4 style={{ marginTop: 18 }}>내가 찜한 기획안</h4>
          {bookmarks.length === 0 ? (
            <div className="empty">아직 찜한 기획안이 없습니다. 마음에 드는 안정형/공격형/혼합형 기획안을 찜하면 여기에 모입니다.</div>
          ) : (
            <div className="evidence-list">
              {bookmarks.slice(0, 6).map((item) => (
                <div className="evidence-item" key={item.key}>
                  <div className="evidence-top"><span className="badge orange">{item.mode}</span><span className="badge">{item.trendName}</span></div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  <div className="idea-actions" style={{ marginTop: 10 }}>
                    <button className="btn small" type="button" onClick={() => onOpenBookmark(item.trendId, item.modeKey)}>열기</button>
                    <button className="btn small ghost" type="button" onClick={() => onRemoveBookmark(item.key)}>찜 해제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
