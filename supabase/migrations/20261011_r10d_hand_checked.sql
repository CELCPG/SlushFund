-- R10d: rows checked by hand against the page image (oge_overrides.json). Idempotent; touches executive_trades only.
alter table executive_trades drop constraint if exists executive_trades_reread_chk;
alter table executive_trades add constraint executive_trades_reread_chk
  check (reread is null or reread in ('strip_kept', 'row_taken', 'unresolved', 'not_mappable',
                                      'hand_ok', 'hand_fixed', 'hand_inserted'));

comment on column executive_trades.reread is 'Asset-text re-read: NULL = not needed (vision read agrees with the OCR layer, or no OCR line to compare). row_taken = a single-row 300 DPI re-read agreed better with the OCR layer and replaced the strip reading; strip_kept = the strip reading agreed at least as well; unresolved = the two readings differ and the OCR layer cannot decide: the single-row reading is stored and the other asset text kept in reread_other_asset (or the single-row reading was unusable and the strip reading stands); not_mappable = the line could not be tied to one table row. R10d (hand check against the page image, src/scripts/oge_overrides.json): hand_ok = checked, the stored row agrees with the page; hand_fixed = corrected to what the page prints; hand_inserted = a printed row the machine reading lost, added by hand (line_on_page >= 101).';
