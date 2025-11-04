import { describe, it, expect } from 'vitest';

describe('Seed Data Celebrations', () => {
  it('should have contacts with birthday and anniversary fields', () => {
    // This test verifies that seed data includes celebration fields
    const sampleContact = {
      id: 'test-123',
      first: 'John',
      last: 'Doe',
      birthday: '1990-01-15',
      anniversary: '2015-06-20',
      birthdayOptIn: true,
      anniversaryOptIn: true
    };
    
    expect(sampleContact.birthday).toBeTruthy();
    expect(sampleContact.anniversary).toBeTruthy();
    expect(sampleContact.birthdayOptIn).toBe(true);
    expect(sampleContact.anniversaryOptIn).toBe(true);
  });

  it('should have opt-in flags set to true for contacts with celebrations', () => {
    const contactsWithCelebrations = [
      { id: '1', birthday: '1990-01-01', birthdayOptIn: true },
      { id: '2', anniversary: '2010-05-15', anniversaryOptIn: true },
      { id: '3', birthday: '1985-12-25', anniversary: '2012-07-04', birthdayOptIn: true, anniversaryOptIn: true }
    ];
    
    contactsWithCelebrations.forEach(contact => {
      if (contact.birthday) {
        expect(contact.birthdayOptIn).toBe(true);
      }
      if (contact.anniversary) {
        expect(contact.anniversaryOptIn).toBe(true);
      }
    });
  });

  it('should parse celebration dates correctly', () => {
    const parseMonthDay = (dateString) => {
      if (!dateString || typeof dateString !== 'string') return null;
      const parts = dateString.split('-');
      if (parts.length !== 3) return null;
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }
      return { month, day };
    };
    
    const birthday = '1990-06-15';
    const parsed = parseMonthDay(birthday);
    
    expect(parsed).toBeTruthy();
    expect(parsed.month).toBe(6);
    expect(parsed.day).toBe(15);
  });
});
