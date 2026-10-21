import { CREDITS, INSTRUMENTS, type CreditId } from "../audio/instruments";
import { useT } from "../i18n/useT";
import { Dialog } from "./Dialog";

export function CreditsDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Dialog title={t("credits.title")} onClose={onClose}>
      <p className="dialog-note">{t("credits.intro")}</p>
      <ul className="credits">
        {(Object.keys(CREDITS) as CreditId[]).map((id) => {
          const credit = CREDITS[id];
          const usedBy = INSTRUMENTS.filter((i) => i.credit === id).map((i) => t(i.nameKey));
          return (
            <li key={id} className="credit">
              <a href={credit.sourceUrl} target="_blank" rel="noreferrer" className="credit-name">
                {credit.name}
              </a>
              <span className="credit-meta">
                {credit.author} ·{" "}
                <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
                  {credit.license}
                </a>
              </span>
              <span className="credit-used">
                {t("credits.usedBy")}: {usedBy.join(", ")}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="dialog-note">
        {t("credits.font")}{" "}
        <a href="https://github.com/jpt/barlow" target="_blank" rel="noreferrer">
          Barlow
        </a>
      </p>
      <p className="dialog-note">
        {t("credits.code")}{" "}
        <a href="https://github.com/JikunLiu101/keytone" target="_blank" rel="noreferrer">
          GitHub
        </a>
        {" · "}
        <a href="https://github.com/danigb/smplr" target="_blank" rel="noreferrer">
          smplr
        </a>
      </p>
    </Dialog>
  );
}
