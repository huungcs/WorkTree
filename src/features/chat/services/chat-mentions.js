export function mentionQuery(text, caret) {
  const match = /(?:^|[\s([{])@([^@\n]{0,64})$/u.exec(text.slice(0, caret));
  return match ? { start: caret - match[1].length - 1, end: caret, query: match[1] } : null;
}

export function updateMentionRanges(before, after, mentions) {
  if (before === after || !mentions.length) return mentions;
  let start = 0;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (start < oldEnd && start < newEnd && before[start] === after[start]) start++;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  const shift = newEnd - oldEnd;
  return mentions.flatMap(mention => {
    if (mention.end <= start) return [mention];
    if (mention.start >= oldEnd) return [{ ...mention, start: mention.start + shift, end: mention.end + shift }];
    return [];
  }).filter(mention => {
    const previous = after[mention.start - 1];
    const next = after[mention.end];
    return (!previous || /[\s([{]/u.test(previous)) && (!next || !/[\p{L}\p{N}_]/u.test(next));
  });
}

export function serializeMentions(text, mentions) {
  const leading = text.length - text.trimStart().length;
  return mentions.map(({ userId, start, end }) => ({
    userId,
    start: Array.from(text.slice(leading, start)).length,
    length: Array.from(text.slice(start, end)).length
  }));
}

export function renderMentionText(text, mentions, escape) {
  if (!mentions?.length) return escape(text);
  const chars = Array.from(text);
  let offset = 0;
  let html = '';
  for (const mention of mentions) {
    const { start, length } = mention || {};
    const end = start + length;
    if (!Number.isInteger(start) || !Number.isInteger(length) || start < offset || length < 2 || end > chars.length || chars[start] !== '@') continue;
    html += escape(chars.slice(offset, start).join(''));
    html += `<span class="chat-mention">${escape(chars.slice(start, end).join(''))}</span>`;
    offset = end;
  }
  return html + escape(chars.slice(offset).join(''));
}
