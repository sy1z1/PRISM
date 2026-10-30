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

export const fetchAssetTickets = async (assetId, groupIds = null) => {
  return await ticketsModel.getTicketsByAssetId(assetId, groupIds);
};

export const fetchDispatchOptions = async (ticketId) => {
  const options = await ticketsModel.getCandidateGroupsForTicket(ticketId);
  if (!options) {
    throw new Error('TICKET_NOT_FOUND');
  }
  return options;
};

export const reassignTicket = async (payload) => {
  return await ticketsModel.assignTicketTransaction(payload);
};

export const acknowledgeTicket = async (payload) => {
  return await ticketsModel.acknowledgeTicketTransaction(payload);
};

export const startTicketWork = async (payload) => {
  return await ticketsModel.startWorkTransaction(payload);
};

export const completeTicket = async (payload) => {
  return await ticketsModel.completeTicketTransaction(payload);
};

export const verifierDecision = async (payload) => {
  return await ticketsModel.verifyTicketTransaction(payload);
};

export const cancelTicket = async (payload) => {
  return await ticketsModel.cancelTicketTransaction(payload);
};

export const reopenTicket = async (payload) => {
  return await ticketsModel.reopenTicketTransaction(payload);
};

export const fetchTicketQueue = async (payload) => {
  return await ticketsModel.listTicketQueue(payload);
};
