const contactLink = (c)=> {
      const nameParts = [];
      if(c && c.first) nameParts.push(c.first);
      if(c && c.last) nameParts.push(c.last);
      const avatarSource = nameParts.length ? nameParts.join(' ') : (c && c.name) || '';
      const avatar = renderAvatar(avatarSource);
      const full = fullName(c);
      const displayName = safe(full);
      const titleAttr = attr(full || '');
      return `<a href="#" class="status-name-link contact-name" data-role="contact-name" data-ui="name-link" data-id="${attr(c.id||'')}" title="${titleAttr}">${avatar}<span class="name-text">${displayName}</span></a>`;
    };