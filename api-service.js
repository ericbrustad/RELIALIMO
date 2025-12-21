// API Service for RELIA🐂LIMO™
import { supabaseConfig, initSupabase } from './config.js';

let supabaseClient = null;
let lastApiError = null;

export function getLastApiError() {
  return lastApiError;
}

async function getOrgContextOrThrow(client) {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('User not authenticated');

  const { data: membership, error: membershipError } = await client
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (membershipError) throw membershipError;
  if (!membership?.organization_id) throw new Error('User not in any organization');

  return { user, organizationId: membership.organization_id };
}

/**
 * Initialize the Supabase client
 */
export async function setupAPI() {
  try {
    supabaseClient = await initSupabase();
    console.log('✅ Supabase API initialized successfully');
    return supabaseClient;
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    throw error;
  }
}

/**
 * Get the Supabase client instance
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    console.warn('⚠️ Supabase client not initialized. Call setupAPI() first.');
  }
  return supabaseClient;
}

/**
 * Example: Fetch all drivers
 */
export async function fetchDrivers() {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    const { data, error } = await client
      .from('drivers')
      .select('*')
      .eq('organization_id', organizationId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching drivers:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Example: Create new driver
 */
export async function createDriver(driverData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('drivers')
      .insert([driverData]);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating driver:', error);
    return null;
  }
}

/**
 * Example: Update driver
 */
export async function updateDriver(driverId, driverData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('drivers')
      .update(driverData)
      .eq('id', driverId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating driver:', error);
    return null;
  }
}

/**
 * Example: Delete driver
 */
export async function deleteDriver(driverId) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('drivers')
      .delete()
      .eq('id', driverId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error deleting driver:', error);
    return null;
  }
}

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeAffiliateName(rawName) {
  if (typeof rawName !== 'string') {
    return '';
  }
  const normalized = normalizeSpaces(rawName);
  return normalized;
}

export async function fetchAllAffiliates() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    lastApiError = null;
    const { data, error } = await client
      .from('affiliate_organizations')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching affiliates:', error);
    lastApiError = error;
    return [];
  }
}

export async function fetchOrganizationAffiliates() {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    const { data, error } = await client
      .from('organization_affiliates')
      .select('affiliate_id, affiliate:affiliate_organizations(id, name)')
      .eq('organization_id', organizationId)
      .order('affiliate(name)', { ascending: true });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    return rows
      .map(row => {
        const affiliate = row?.affiliate;
        const id = affiliate?.id || row?.affiliate_id;
        const name = affiliate?.name || '';
        if (!id || !name) {
          return null;
        }
        return { id, name };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Error fetching organization affiliates:', error);
    lastApiError = error;
    return [];
  }
}

export async function ensureAffiliateForOrganization(rawName) {
  const client = getSupabaseClient();
  if (!client) return null;

  const name = normalizeAffiliateName(rawName);
  if (!name) {
    throw new Error('Affiliate name is required');
  }

  try {
    lastApiError = null;
    const literal = name.replace(/[%_]/g, match => `\\${match}`);

    const { data: existingRows, error: existingError } = await client
      .from('affiliate_organizations')
      .select('id, name')
      .ilike('name', literal)
      .limit(1);

    if (existingError) throw existingError;

    let affiliate = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

    if (!affiliate) {
      const { data: inserted, error: insertError } = await client
        .from('affiliate_organizations')
        .insert([{ name }])
        .select('id, name')
        .single();

      if (insertError) {
        if (insertError.code === '23505' || /duplicate/i.test(insertError.message || '')) {
          const { data: retryRows, error: retryError } = await client
            .from('affiliate_organizations')
            .select('id, name')
            .ilike('name', literal)
            .limit(1);

          if (retryError) throw retryError;
          affiliate = Array.isArray(retryRows) && retryRows.length > 0 ? retryRows[0] : null;
        } else {
          throw insertError;
        }
      } else {
        affiliate = inserted;
      }
    }

    if (!affiliate) {
      throw new Error('Unable to resolve affiliate');
    }

    const { organizationId } = await getOrgContextOrThrow(client);

    const { error: linkError } = await client
      .from('organization_affiliates')
      .upsert({
        organization_id: organizationId,
        affiliate_id: affiliate.id
      }, { onConflict: 'organization_id,affiliate_id' });

    if (linkError && linkError.code !== '23505') {
      throw linkError;
    }

    return {
      affiliateId: affiliate.id,
      affiliateName: affiliate.name
    };
  } catch (error) {
    console.error('Error ensuring affiliate:', error);
    lastApiError = error;
    throw error;
  }
}

/**
 * Create new reservation
 */
export async function createReservation(reservationData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('reservations')
      .insert([{
        pickup_location: reservationData.routing?.stops?.[0]?.address || '',
        dropoff_location: reservationData.routing?.stops?.[1]?.address || '',
        passenger_first_name: reservationData.passenger?.firstName || '',
        passenger_last_name: reservationData.passenger?.lastName || '',
        passenger_phone: reservationData.passenger?.phone || '',
        passenger_email: reservationData.passenger?.email || '',
        billing_account: reservationData.billingAccount?.account || '',
        booked_by_name: `${reservationData.bookedBy?.firstName} ${reservationData.bookedBy?.lastName}`.trim(),
        booked_by_email: reservationData.bookedBy?.email || '',
        trip_notes: reservationData.routing?.tripNotes || '',
        billing_notes: reservationData.routing?.billPaxNotes || '',
        dispatch_notes: reservationData.routing?.dispatchNotes || '',
        total_cost: reservationData.grandTotal || 0,
        status: 'pending',
        affiliate_id: reservationData.affiliateId || reservationData.affiliate_id || null
      }]);
    
    if (error) throw error;
    console.log('✅ Reservation created:', data);
    return data;
  } catch (error) {
    console.error('Error creating reservation:', error);
    return null;
  }
}

/**
 * Update reservation
 */
export async function updateReservation(reservationId, reservationData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('reservations')
      .update({
        pickup_location: reservationData.routing?.stops?.[0]?.address || '',
        dropoff_location: reservationData.routing?.stops?.[1]?.address || '',
        passenger_first_name: reservationData.passenger?.firstName || '',
        passenger_last_name: reservationData.passenger?.lastName || '',
        passenger_phone: reservationData.passenger?.phone || '',
        passenger_email: reservationData.passenger?.email || '',
        trip_notes: reservationData.routing?.tripNotes || '',
        billing_notes: reservationData.routing?.billPaxNotes || '',
        dispatch_notes: reservationData.routing?.dispatchNotes || '',
        total_cost: reservationData.grandTotal || 0,
        affiliate_id: reservationData.affiliateId || reservationData.affiliate_id || null
      })
      .eq('id', reservationId);
    
    if (error) throw error;
    console.log('✅ Reservation updated:', data);
    return data;
  } catch (error) {
    console.error('Error updating reservation:', error);
    return null;
  }
}

/**
 * Fetch all reservations
 */
export async function fetchReservations() {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return null;
  }
}

/**
 * Get reservation by ID
 */
export async function getReservation(reservationId) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return null;
  }
}

/**
 * Search airports by name or code
 */
export async function searchAirports(query) {
  try {
    // Using OpenFlights Airport database via public API
    const response = await fetch(`https://api.flightapi.io/airports?search=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Fallback to static airport list if API fails
      return getStaticAirports(query);
    }
    
    const data = await response.json();
    return data.airports || [];
  } catch (error) {
    console.error('Airport search error:', error);
    return getStaticAirports(query);
  }
}

/**
 * Static airport list for fallback
 */
function getStaticAirports(query) {
  const airports = [
    { code: 'MSP', name: 'Minneapolis-Saint Paul International', city: 'Minneapolis', state: 'MN' },
    { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', state: 'NY' },
    { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', state: 'CA' },
    { code: 'ORD', name: 'Chicago O\'Hare International', city: 'Chicago', state: 'IL' },
    { code: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', state: 'TX' },
    { code: 'DEN', name: 'Denver International', city: 'Denver', state: 'CO' },
    { code: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', state: 'WA' },
    { code: 'SFO', name: 'San Francisco International', city: 'San Francisco', state: 'CA' },
    { code: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', state: 'NV' },
    { code: 'MIA', name: 'Miami International', city: 'Miami', state: 'FL' }
  ];
  
  const q = query.toLowerCase();
  return airports.filter(a => 
    a.code.toLowerCase().includes(q) || 
    a.name.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q)
  );
}

/**
 * Geocode address using Nominatim (OpenStreetMap)
 */
export async function geocodeAddress(address) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RELIA-LIMO-APP'
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Geocoding service unavailable');
      return [];
    }
    
    const data = await response.json();
    return data.map(result => ({
      name: result.name,
      address: result.display_name,
      latitude: result.lat,
      longitude: result.lon,
      context: {
        city: result.address?.city,
        state: result.address?.state,
        zipcode: result.address?.postcode,
        country: result.address?.country
      }
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RELIA-LIMO-APP'
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Reverse geocoding service unavailable');
      return null;
    }
    
    const data = await response.json();
    return {
      name: data.name,
      address: data.display_name,
      latitude: data.lat,
      longitude: data.lon,
      context: {
        city: data.address?.city,
        state: data.address?.state,
        zipcode: data.address?.postcode,
        country: data.address?.country
      }
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates
 */
export async function calculateDistance(start, end) {
  try {
    // Using OSRM (Open Source Routing Machine)
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Distance calculation service unavailable');
      return null;
    }
    
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distance_miles: (route.distance * 0.000621371).toFixed(2),
        distance_km: (route.distance / 1000).toFixed(2),
        duration_minutes: Math.round(route.duration / 60),
        duration_hours: (route.duration / 3600).toFixed(2)
      };
    }
    return null;
  } catch (error) {
    console.error('Distance calculation error:', error);
    return null;
  }
}

/**
 * Create or update account in Supabase
 */
export async function saveAccountToSupabase(accountData) {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('⚠️ Supabase client not available, skipping account sync');
    return null;
  }
  
  try {
    lastApiError = null;
    const { user, organizationId } = await getOrgContextOrThrow(client);
    
    // Prepare account data for Supabase with all fields
    const supabaseAccount = {
      organization_id: organizationId,
      account_number: accountData.account_number || accountData.id,
      first_name: accountData.first_name,
      last_name: accountData.last_name,
      company_name: accountData.company_name,
      department: accountData.department,
      job_title: accountData.job_title,
      email: accountData.email,
      phone: accountData.phone,
      cell_phone: accountData.cell_phone || accountData.phone,
      
      // Additional phone fields
      office_phone: accountData.office_phone,
      office_phone_ext: accountData.office_phone_ext,
      home_phone: accountData.home_phone,
      home_phone_ext: accountData.home_phone_ext,
      cell_phone_2: accountData.cell_phone_2,
      cell_phone_3: accountData.cell_phone_3,
      fax_1: accountData.fax_1,
      fax_2: accountData.fax_2,
      fax_3: accountData.fax_3,
      
      // Address fields
      address_line1: accountData.address_line1,
      address_line2: accountData.address_line2,
      city: accountData.city,
      state: accountData.state,
      zip: accountData.zip,
      country: accountData.country || 'US',
      
      // Notes
      internal_notes: accountData.internal_notes,
      trip_notes: accountData.trip_notes,
      notes_others: accountData.notes_others,
      
      // Restrictions (stored as JSON arrays)
      restricted_drivers: accountData.restricted_drivers || [],
      restricted_cars: accountData.restricted_cars || [],
      
      // Settings
      source: accountData.source,
      rental_agreement: accountData.rental_agreement,
      account_settings: accountData.account_settings || 'normal',
      status: accountData.status || 'active',
      web_access: accountData.web_access || 'allow',
      
      // Account types
      is_billing_client: accountData.is_billing_client || false,
      is_passenger: accountData.is_passenger || false,
      is_booking_contact: accountData.is_booking_contact || false,
      
      // Email preferences (default to true if not explicitly set)
      email_pref_all: accountData.email_pref_all !== false,
      email_pref_confirmation: accountData.email_pref_confirmation !== false,
      email_pref_payment_receipt: accountData.email_pref_payment_receipt !== false,
      email_pref_invoice: accountData.email_pref_invoice !== false,
      email_pref_other: accountData.email_pref_other !== false,
      
      // Financial/legacy fields
      post_method: accountData.post_method,
      post_terms: accountData.post_terms,
      primary_agent_assigned: accountData.primary_agent_assigned,
      secondary_agent_assigned: accountData.secondary_agent_assigned,
      credit_card_number: accountData.credit_card_number,
      name_on_card: accountData.name_on_card,
      billing_address: accountData.billing_address,
      billing_city: accountData.billing_city,
      billing_state: accountData.billing_state,
      billing_zip: accountData.billing_zip,
      exp_month: accountData.exp_month,
      exp_year: accountData.exp_year,
      cc_type: accountData.cc_type,
      cvv: accountData.cvv,
      notes: accountData.notes,
      
      created_by: user.id,
      updated_by: user.id
    };
    
    // Check for existing account by account number
    const { data: existingRows, error: existingError } = await client
      .from('accounts')
      .select('id')
      .eq('account_number', supabaseAccount.account_number)
      .eq('organization_id', organizationId);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    
    if (existing) {
      // Update existing account
      const { data, error } = await client
        .from('accounts')
        .update(supabaseAccount)
        .eq('id', existing.id)
        .select();
      
      if (error) throw error;
      console.log('✅ Account updated in Supabase:', data);
      return data[0];
    } else {
      // Insert new account
      const { data, error } = await client
        .from('accounts')
        .insert([supabaseAccount])
        .select();
      
      if (error) throw error;
      console.log('✅ Account created in Supabase:', data);
      return data[0];
    }
  } catch (error) {
    console.error('❌ Error saving account to Supabase:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Fetch accounts from Supabase
 */
export async function fetchAccounts() {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { organizationId } = await getOrgContextOrThrow(client);

    const { data, error } = await client
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    console.log('✅ Fetched accounts from Supabase:', data?.length);
    return data;
  } catch (error) {
    console.error('❌ Error fetching accounts:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Save passenger to Supabase
 */
export async function savePassengerToSupabase(passengerData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { user, organizationId } = await getOrgContextOrThrow(client);
    
    const supabasePassenger = {
      organization_id: organizationId,
      first_name: passengerData.firstName || passengerData.first_name,
      last_name: passengerData.lastName || passengerData.last_name,
      phone: passengerData.phone,
      email: passengerData.email,
      alt_contact_name: passengerData.altContactName || passengerData.alt_contact_name,
      alt_contact_phone: passengerData.altContactPhone || passengerData.alt_contact_phone,
      notes: passengerData.notes,
      created_by: user.id,
      updated_by: user.id
    };
    
    // Check for duplicate
    const { data: existingRows, error: existingError } = await client
      .from('passengers')
      .select('id')
      .eq('first_name', supabasePassenger.first_name)
      .eq('last_name', supabasePassenger.last_name)
      .eq('email', supabasePassenger.email)
      .eq('organization_id', organizationId);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    
    if (existing) {
      const { data, error } = await client
        .from('passengers')
        .update(supabasePassenger)
        .eq('id', existing.id)
        .select();
      
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await client
        .from('passengers')
        .insert([supabasePassenger])
        .select();
      
      if (error) throw error;
      return data[0];
    }
  } catch (error) {
    console.error('❌ Error saving passenger to Supabase:', error);
    lastApiError = error;
    return null;
  }
}

/**
 * Save booking agent to Supabase
 */
export async function saveBookingAgentToSupabase(agentData) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  try {
    lastApiError = null;
    const { user, organizationId } = await getOrgContextOrThrow(client);
    
    const supabaseAgent = {
      organization_id: organizationId,
      first_name: agentData.firstName || agentData.first_name,
      last_name: agentData.lastName || agentData.last_name,
      phone: agentData.phone,
      email: agentData.email,
      notes: agentData.notes,
      created_by: user.id,
      updated_by: user.id
    };
    
    // Check for duplicate
    const { data: existingRows, error: existingError } = await client
      .from('booking_agents')
      .select('id')
      .eq('first_name', supabaseAgent.first_name)
      .eq('last_name', supabaseAgent.last_name)
      .eq('email', supabaseAgent.email)
      .eq('organization_id', organizationId);

    if (existingError) throw existingError;
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    
    if (existing) {
      const { data, error } = await client
        .from('booking_agents')
        .update(supabaseAgent)
        .eq('id', existing.id)
        .select();
      
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await client
        .from('booking_agents')
        .insert([supabaseAgent])
        .select();
      
      if (error) throw error;
      return data[0];
    }
  } catch (error) {
    console.error('❌ Error saving booking agent to Supabase:', error);
    lastApiError = error;
    return null;
  }
}
