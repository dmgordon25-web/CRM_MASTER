import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../crm-app');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function extractTemplate(id) {
  const pattern = new RegExp(`<template\\s+id=\\"${id}\\">([\\s\\S]*?)<\\/template>`, 'i');
  const match = html.match(pattern);
  return match ? match[1] : '';
}

function sliceMarkup(startMarker, endMarker) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx < 0) return '';
  const endIdx = endMarker ? html.indexOf(endMarker, startIdx) : -1;
  return html.slice(startIdx, endIdx > startIdx ? endIdx : undefined);
}

describe('editor nameplates', () => {
  it('renders a partner nameplate with defaults in the partner editor', () => {
    const partnerMarkup = sliceMarkup('id="partner-modal"', '<!-- Contact Modal placeholder -->');
    expect(partnerMarkup).toContain('data-role="record-nameplate"');
    expect(partnerMarkup).toContain('data-record-type="partner"');
    expect(partnerMarkup).toContain('data-role="record-name-text">New Partner');
    expect(partnerMarkup).toContain('data-role="record-name-subtext">Developing • Realtor Partner');
  });

  it('renders a contact nameplate with defaults in the contact editor', () => {
    const template = extractTemplate('contact-editor-template');
    expect(template).toContain('data-role="record-nameplate"');
    expect(template).toContain('data-record-type="contact"');
    expect(template).toContain('data-role="record-name-text">New Contact');
    expect(template).toContain('data-role="record-name-subtext">Application • In Progress');
  });
});
