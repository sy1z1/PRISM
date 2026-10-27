import * as ticketsModel from './tickets.model.js';
import { getAssetWithSiteDetails } from '../assets/assets.model.js';

export const reportIssue = async (payload) => {
  const asset = await getAssetWithSiteDetails(payload.assetId);
  if (!asset) {
    throw new Error('ASSET_NOT_FOUND');
  }
  return await ticketsModel.createTicketTransaction(payload);
};

export const fetchTicketDetails = async (ticketId) => {
  const ticket = await ticketsModel.getTicketById(ticketId);
  if (!ticket) {
    throw new Error('TICKET_NOT_FOUND');
  }
  return ticket;
};

export const fetchAssetTickets = async (assetId) => {
  return await ticketsModel.getTicketsByAssetId(assetId);
};

export const fetchDispatchOptions = async (ticketId) => {
  const options = await ticketsModel.getCandidateGroupsForTicket(ticketId);
  if (!options) {
    throw new Error('TICKET_NOT_FOUND');
  }
  return options;
};

export const dispatchTicket = async (payload) => {
  return await ticketsModel.assignTicketTransaction(payload);
};

export const acceptAndStartTicket = async (payload) => {
  return await ticketsModel.startWorkTransaction(payload);
};

export const submitForVerification = async (payload) => {
  return await ticketsModel.resolveTicketTransaction(payload);
};

export const managementVerifyTicket = async (payload) => {
  return await ticketsModel.verifyTicketTransaction(payload);
};