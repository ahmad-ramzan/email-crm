"use client";

import React, { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import styles from "./crm.module.css";
import { markOutreachToday, createLead, updateLead, deleteLead } from "./actions";

export type LeadStatus = "new" | "warm" | "hot" | "closed";

export interface Lead {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  phone: string | null;
  status: LeadStatus;
  notes: string | null;
  location: string | null;
  role: string | null;
  social_instagram: string | null;
  social_linkedin: string | null;
  website: string | null;
  last_outreach_date: string | null;
  created_at: string;
  timeline: LeadTimeline[];
}

export interface LeadTimeline {
  id: string;
  title: string;
  description: string | null;
  date: string;
}

interface Props {
  initialLeads: Lead[];
}

export default function CrmDashboard({ initialLeads }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedEmailLead, setSelectedEmailLead] = useState<Lead | null>(null);
  const [emailMessage, setEmailMessage] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    social_linkedin: "",
    social_instagram: "",
    website: "",
    location: "",
    status: "new" as LeadStatus,
    role: "",
    notes: "",
  });

  const isToday = (dateString: string | null) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        lead.full_name.toLowerCase().includes(q) ||
        (lead.company?.toLowerCase() || "").includes(q) ||
        lead.email.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

      let matchesDate = true;
      if (dateFilter) {
        if (lead.last_outreach_date) {
          const outreachDate = new Date(lead.last_outreach_date).toISOString().split('T')[0];
          matchesDate = outreachDate === dateFilter;
        } else {
          matchesDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [leads, searchQuery, statusFilter, dateFilter]);

  const outreachTodayCount = leads.filter(l => isToday(l.last_outreach_date)).length;

  const handleRowClick = (leadId: string, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest("a") || target.closest(`.${styles.markToday}`) || target.closest("button")) {
      return;
    }
    setExpandedLeadId(expandedLeadId === leadId ? null : leadId);
  };

  const handleMarkToday = async (leadId: string, checked: boolean) => {
    const newDate = checked ? new Date().toISOString() : null;

    setLeads(current =>
      current.map(l => l.id === leadId ? { ...l, last_outreach_date: newDate } : l)
    );

    try {
      await markOutreachToday(leadId, checked);
    } catch (e) {
      console.error(e);
      alert("Failed to update outreach status");
    }
  };

  const handleEmailClick = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEmailLead(lead);
    setIsEmailModalOpen(true);
    setEmailMessage("");
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Email simulation: Sent message to ${selectedEmailLead?.email}`);
    setIsEmailModalOpen(false);
    setSelectedEmailLead(null);
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      social_linkedin: "",
      social_instagram: "",
      website: "",
      location: "",
      status: "new",
      role: "",
      notes: "",
    });
    setEditingLeadId(null);
  };

  const handleEditClick = (lead: Lead) => {
    setFormData({
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone || "",
      social_linkedin: lead.social_linkedin || "",
      social_instagram: lead.social_instagram || "",
      website: lead.website || "",
      location: lead.location || "",
      status: lead.status,
      role: lead.role || "",
      notes: lead.notes || "",
    });
    setEditingLeadId(lead.id);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (leadId: string) => {
    if (!window.confirm("Are you sure you want to delete this lead?")) return;

    setLeads(current => current.filter(l => l.id !== leadId));
    if (expandedLeadId === leadId) setExpandedLeadId(null);

    try {
      await deleteLead(leadId);
    } catch (error) {
      console.error("Failed to delete lead", error);
      alert("Failed to delete lead.");
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLeadId) {
        const updatedLead = await updateLead(editingLeadId, formData);
        setLeads(current => current.map(l => l.id === editingLeadId ? { ...l, ...updatedLead } : l));
        setIsModalOpen(false);
        resetForm();
      } else {
        const newLead = await createLead(formData);
        setLeads([newLead, ...leads]);
        setIsModalOpen(false);
        resetForm();
      }
    } catch (error: any) {
      console.error("Failed to save lead", error);
      alert(`Failed to save lead: ${error.message || "Ensure the Supabase schema is loaded and variables are correct."}`);
    }
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let importedCount = 0;

        // Disable file input temporarily or show loading state if preferred
        // We do sequential inserts to avoid overwhelming the DB
        for (const row of rows) {
          try {
            // Map the user's specific CSV headers to our fields
            const newLeadData: Partial<Lead> = {
              full_name: row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Unknown Lead',
              company: row.companyName || null,
              email: row.email || '',
              phone: row.phone || null,
              social_linkedin: row.linkedinUrl ? (row.linkedinUrl.startsWith('http') ? row.linkedinUrl : `https://${row.linkedinUrl}`) : null,
              social_instagram: null, // Not in CSV
              website: row.companyDomain || null,
              location: row.personCountry || null,
              status: row.rowType === 'lead' ? 'new' : 'new',
              role: row.title || null,
              notes: null,
            };

            // Only import if we at least have a name or email
            if (newLeadData.full_name !== 'Unknown Lead' || newLeadData.email) {
              const imported = await createLead(newLeadData);
              setLeads(prev => [imported, ...prev]);
              importedCount++;
            }
          } catch (err) {
            console.error("Failed to import row", row, err);
          }
        }

        alert(`Successfully imported ${importedCount} leads from CSV!`);

        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error("CSV Parse Error", error);
        alert("Failed to parse CSV file.");
      }
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0" />
      <div className={styles.pageWrapper}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <img src="https://ui-avatars.com/api/?name=GN&background=4f46e5&color=fff&rounded=true&bold=true&size=128" alt="GrownWithNextify Logo" className={styles.logoImg} />
            <div className={styles.brandText}>
              <h1>GrownWithNextify</h1>
              <p>Outreach Dashboard</p>
            </div>
          </div>

          <div className={styles.topActions}>
            <button className={styles.iconBtn} aria-label="Notifications" title="Notifications">
              <span className="material-symbols-outlined">notifications</span>
              <span className={styles.badge}></span>
            </button>

            <div className={styles.divider}></div>

            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImportCSV}
            />
            <button className={`${styles.btn} ${styles.btnLight}`} onClick={() => fileInputRef.current?.click()}>
              <span className="material-symbols-outlined">upload_file</span> Import CSV
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setIsModalOpen(true)}>
              <span className="material-symbols-outlined">add</span> Add Lead
            </button>
          </div>
        </header>
        <div className={styles.crm}>

          <section className={styles.stats}>
            <div className={styles.stat}>
              <span>Total Customers</span>
              <strong>{leads.length.toString().padStart(2, "0")}</strong>
            </div>
            <div className={styles.stat}>
              <span>Hot Leads</span>
              <strong>{leads.filter((l) => l.status === "hot").length.toString().padStart(2, "0")}</strong>
            </div>
            <div className={styles.stat}>
              <span>Outreach Today</span>
              <strong>{outreachTodayCount.toString().padStart(2, "0")}</strong>
            </div>
            <div className={styles.stat}>
              <span>Calls Booked</span>
              <strong>00</strong> {/* Static for now */}
            </div>
          </section>

          <section className={styles.filters}>
            <div className={styles.field}>
              <span className="material-symbols-outlined">search</span>
              <input
                type="text"
                placeholder="Search customer, company, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="hot">Hot Lead</option>
                <option value="warm">Warm Lead</option>
                <option value="new">New Lead</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className={styles.field}>
              <span className="material-symbols-outlined">event</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </section>

          <section className={styles.tableWrap}>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Outreach Today</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length > 0 ? (
                    filteredLeads.map((lead) => {
                      const isExpanded = expandedLeadId === lead.id;
                      const contactedToday = isToday(lead.last_outreach_date);
                      
                      const extractedCompany = lead.notes?.match(/Company:\s*([^\n]+)/i)?.[1];
                      const displayCompany = lead.company || extractedCompany || "-";
                      const displayNotes = lead.notes ? lead.notes.replace(/Company:\s*([^\n]+)/i, '').trim() : null;

                      return (
                        <React.Fragment key={lead.id}>
                        <tr
                          className={`${styles.customerRow} ${isExpanded ? styles.customerRowActive : ""}`}
                          onClick={(e) => handleRowClick(lead.id, e)}
                        >
                          <td>
                            <div className={styles.customer}>
                              <div className={styles.avatar}>{getInitials(lead.full_name)}</div>
                              <div>
                                <strong>{lead.full_name}</strong>
                                <span>{displayCompany === "-" ? "No Company" : displayCompany}</span>
                              </div>
                            </div>
                          </td>
                          <td>{lead.email}</td>
                          <td>
                            <span className={`${styles.pill} ${lead.status === 'hot' ? styles.pillHot :
                              lead.status === 'warm' ? styles.pillWarm :
                                lead.status === 'new' ? styles.pillNew : styles.pillClosed
                              }`}>
                              {lead.status === 'hot' ? 'Hot Lead' :
                                lead.status === 'warm' ? 'Warm Lead' :
                                  lead.status === 'new' ? 'New Lead' : 'Closed'}
                            </span>
                          </td>
                          <td>
                            <label className={styles.markToday}>
                              <input
                                type="checkbox"
                                checked={contactedToday}
                                onChange={(e) => handleMarkToday(lead.id, e.target.checked)}
                              /> Mark
                            </label>
                          </td>
                          <td>
                            <div className={styles.contactActions}>
                              <button type="button" title="Email" onClick={(e) => handleEmailClick(lead, e)}>
                                <span className="material-symbols-outlined">mail</span>
                              </button>
                              {lead.phone && (
                                <a href={`tel:${lead.phone}`} title="Call" onClick={(e) => e.stopPropagation()}>
                                  <span className="material-symbols-outlined">call</span>
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className={`${styles.detailsRow} ${styles.detailsRowShow}`}>
                            <td className={styles.detailsCell} colSpan={5}>
                              <div className={styles.detailsPanel}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <p className={styles.sectionTitle} style={{ marginBottom: 0 }}><span className="material-symbols-outlined">person</span> Customer Information</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <button type="button" className={`${styles.btn} ${styles.btnLight}`} onClick={() => handleEditClick(lead)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span> Edit
                                      </button>
                                      <button type="button" className={`${styles.btn} ${styles.btnLight}`} onClick={() => handleDeleteClick(lead.id)} style={{ color: 'var(--hot)', borderColor: '#fecaca' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span> Delete
                                      </button>
                                    </div>
                                  </div>
                                  <div className={styles.infoGrid}>
                                    <div className={styles.infoBox}><span>Email</span><strong>{lead.email}</strong></div>
                                    <div className={styles.infoBox}><span>Phone</span><strong>{lead.phone || "-"}</strong></div>
                                    <div className={styles.infoBox}><span>Company</span><strong>{displayCompany}</strong></div>
                                    <div className={styles.infoBox}><span>Designantion</span><strong>{lead.role || "-"}</strong></div>
                                    <div className={styles.infoBox}><span>Location</span><strong>{lead.location || "-"}</strong></div>
                                    {displayNotes && <p className={styles.note}>{displayNotes}</p>}
                                  </div>
                                </div>

                                <div>
                                  <p className={styles.sectionTitle}><span className="material-symbols-outlined">link</span> Profiles & Outreach</p>
                                  <div className={styles.socialGrid}>
                                    {lead.website ? (
                                      <a className={styles.socialTile} href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer">
                                        <span className={`material-symbols-outlined ${styles.socialIcon}`}>language</span>
                                        <div>
                                          <strong>Website</strong>
                                          <span>{lead.website.replace(/^https?:\/\//, '')}</span>
                                        </div>
                                        <span className={`material-symbols-outlined ${styles.goto}`}>open_in_new</span>
                                      </a>
                                    ) : null}

                                    {lead.social_instagram ? (
                                      <a className={styles.socialTile} href={lead.social_instagram.startsWith('http') ? lead.social_instagram : `https://instagram.com/${lead.social_instagram}`} target="_blank" rel="noopener noreferrer">
                                        <span className={`material-symbols-outlined ${styles.socialIcon}`}>photo_camera</span>
                                        <div>
                                          <strong>Instagram</strong>
                                          <span>{lead.social_instagram}</span>
                                        </div>
                                        <span className={`material-symbols-outlined ${styles.goto}`}>open_in_new</span>
                                      </a>
                                    ) : (
                                      <div className={styles.socialTile} style={{ opacity: 0.5 }}>
                                        <span className={`material-symbols-outlined ${styles.socialIcon}`}>photo_camera</span>
                                        <div><strong>Instagram</strong><span>Not provided</span></div>
                                      </div>
                                    )}
                                    {lead.social_linkedin ? (
                                      <a className={styles.socialTile} href={lead.social_linkedin.startsWith('http') ? lead.social_linkedin : `https://linkedin.com/in/${lead.social_linkedin}`} target="_blank" rel="noopener noreferrer">
                                        <span className={`material-symbols-outlined ${styles.socialIcon}`}>work</span>
                                        <div>
                                          <strong>LinkedIn</strong>
                                          <span>{lead.social_linkedin}</span>
                                        </div>
                                        <span className={`material-symbols-outlined ${styles.goto}`}>open_in_new</span>
                                      </a>
                                    ) : (
                                      <div className={styles.socialTile} style={{ opacity: 0.5 }}>
                                        <span className={`material-symbols-outlined ${styles.socialIcon}`}>work</span>
                                        <div><strong>LinkedIn</strong><span>Not provided</span></div>
                                      </div>
                                    )}
                                  </div>

                                  <div className={styles.timeline}>
                                    {lead.timeline && lead.timeline.length > 0 ? lead.timeline.map((item) => (
                                      <div className={styles.timelineItem} key={item.id}>
                                        <strong>{item.title}</strong>
                                        {item.description && <span>{item.description}</span>}
                                        <small>{new Date(item.date).toLocaleDateString()}</small>
                                      </div>
                                    )) : (
                                      <div className={styles.timelineItem}>
                                        <strong>No timeline events</strong>
                                        <span>Start outreach to build a history.</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })
                  ) : null}
                </tbody>
              </table>

              {filteredLeads.length === 0 && (
                <div className={`${styles.empty} ${styles.emptyShow}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '12px', color: '#cbd5e1' }}>search_off</span>
                  <p>No customer found. Try another search keyword or filter.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {isModalOpen && (
        <div className={`${styles.modalOverlay} ${styles.modalOverlayShow}`} onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2>{editingLeadId ? 'Edit Lead' : 'Add New Lead'}</h2>
              <button type="button" className={styles.closeBtn} onClick={() => { setIsModalOpen(false); resetForm(); }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className={styles.modalBody}>
              <form id="addLeadForm" onSubmit={handleFormSubmit}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Full Name</label>
                    <input type="text" className={styles.formControl} placeholder="e.g. Jane Doe" required
                      value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Designation</label>
                    <input type="text" className={styles.formControl} placeholder="e.g. CEO, Marketing Director" required
                      value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Email Address</label>
                    <input type="email" className={styles.formControl} placeholder="jane@example.com" required
                      value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>

                  <div className={styles.formGroup}>
                    <label>WhatsApp Number</label>
                    <input type="tel" className={styles.formControl} placeholder="+1 234 567 8900" required
                      value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Lead Status</label>
                    <select className={styles.formControl} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as LeadStatus })} required>
                      <option value="new">New Lead</option>
                      <option value="warm">Warm Lead</option>
                      <option value="hot">Hot Lead</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>LinkedIn URL</label>
                    <input type="url" className={styles.formControl} placeholder="https://linkedin.com/in/..." required
                      value={formData.social_linkedin} onChange={e => setFormData({ ...formData, social_linkedin: e.target.value })} />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Instagram URL</label>
                    <input type="url" className={styles.formControl} placeholder="https://instagram.com/..." required
                      value={formData.social_instagram} onChange={e => setFormData({ ...formData, social_instagram: e.target.value })} />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Website URL</label>
                    <input type="url" className={styles.formControl} placeholder="https://example.com"
                      value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} />
                  </div>

                  <div className={`${styles.formGroup} ${styles.formGroupFullWidth}`}>
                    <label>Country</label>
                    <input type="text" className={styles.formControl} placeholder="e.g. United States, UK, UAE" required
                      value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                  </div>

                  <div className={`${styles.formGroup} ${styles.formGroupFullWidth}`}>
                    <label>Company</label>
                    <textarea className={styles.formControl} placeholder="Add any details about the client's needs, objections, or project scope..."
                      value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
                  </div>
                </div>
              </form>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnLight}`} onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancel</button>
              <button type="submit" form="addLeadForm" className={`${styles.btn} ${styles.btnPrimary}`}>{editingLeadId ? 'Update Lead' : 'Save Lead'}</button>
            </div>
          </div>
        </div>
      )}

      {isEmailModalOpen && selectedEmailLead && (
        <div className={`${styles.modalOverlay} ${styles.modalOverlayShow}`} onClick={(e) => e.target === e.currentTarget && setIsEmailModalOpen(false)}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2>Send Email</h2>
              <button className={styles.closeBtn} onClick={() => setIsEmailModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className={styles.modalBody}>
              <form id="sendEmailForm" onSubmit={handleSendEmail}>
                <div className={styles.formGrid}>
                  <div className={`${styles.formGroup} ${styles.formGroupFullWidth}`}>
                    <label>From</label>
                    <input type="email" className={styles.formControl} value="contact@gwnclientcrm.com" disabled />
                  </div>

                  <div className={`${styles.formGroup} ${styles.formGroupFullWidth}`}>
                    <label>To</label>
                    <input type="email" className={styles.formControl} value={selectedEmailLead.email} disabled />
                  </div>

                  <div className={`${styles.formGroup} ${styles.formGroupFullWidth}`}>
                    <label>Message</label>
                    <textarea
                      className={styles.formControl}
                      placeholder="Type your email message here..."
                      required
                      style={{ height: '150px' }}
                      value={emailMessage}
                      onChange={e => setEmailMessage(e.target.value)}
                    ></textarea>
                  </div>
                </div>
              </form>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnLight}`} onClick={() => setIsEmailModalOpen(false)}>Cancel</button>
              <button type="submit" form="sendEmailForm" className={`${styles.btn} ${styles.btnPrimary}`}>Send Message</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
