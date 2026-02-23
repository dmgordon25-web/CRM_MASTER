import { openPartnerEditModal, closePartnerEditModal } from '../../partner_edit_modal.js';

if(typeof window !== 'undefined'){
  if(typeof window.openPartnerEditModal !== 'function'){
    window.openPartnerEditModal = function(partnerId, options){
      return openPartnerEditModal(partnerId, options);
    };
  }
  if(typeof window.closePartnerEditModal !== 'function'){
    window.closePartnerEditModal = function(){
      return closePartnerEditModal();
    };
  }
}

export { openPartnerEditModal, closePartnerEditModal };

export default {
  openPartnerEditModal,
  closePartnerEditModal
};
