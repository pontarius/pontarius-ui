#!/usr/bin/gjs

/*

Defines a GtkApplication that exposes the functionality of Pontarius Service.

Copyright © Jon Kristensen, 2014.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program. If not, see <http://www.gnu.org/licenses/>.

*/

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Pango = imports.gi.Pango;

const PREFER_DARK_THEME = false;
const OVERRIDE_DARK_BACKGROUND_COLOR = false;

const State = {
    CREDENTIALS_UNSET: 0,
    IDENTITY_NOT_FOUND: 1,
    IDENTITIES_AVAILABLE: 2,
    CREATING_IDENTITY: 3,
    DISABLED: 4,
    AUTHENTICATING: 5,
    AUTHENTICATED: 6,
    AUTHENTICATION_DENIED: 7
};

const Contacts = new Lang.Class({
    Name: 'Contacts',
    Extends: Gtk.Application,
    _init: function() {
        this.parent({ flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE });

        // this._gConf = GConf.Client.get_default();

        this.connect('activate', Lang.bind(this, this._onActivate));
        this.connect('command-line', Lang.bind(this, this._onCommandLine));
        this.connect('startup', Lang.bind(this, this._onStartup));
    },
    _onActivate: function() {
        if(PREFER_DARK_THEME) {
            Gtk.Settings.get_default().
                gtk_application_prefer_dark_theme = true;

            if(OVERRIDE_DARK_BACKGROUND_COLOR) {
                // Set tab content background color to be different from the
                // background color of list boxes.
                let cssProvider = new Gtk.CssProvider();
                cssProvider.load_from_data(
                    'GtkNotebook > GtkBox { background-color: #393f3f; }');
                Gtk.StyleContext.add_provider_for_screen(
                    Gdk.Screen.get_default(),
                    cssProvider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
            }
        }
    },
    _onCommandLine: function(app, commandLine) {
        let args = commandLine.get_arguments();

        if(args[0] === '--settings') {
            this._settingsWindow.present();
        }
        else if(args[0] === '--assign-to-contact' && args.length === 2) {
            // Assign args[1] to contact!
        }
        else {
            app.activate();
        }
    },
    _onStartup: function() {
        this._builder = new Gtk.Builder();
        this._builder.add_from_file('contacts.glade');

        this._initializeMenu();
        this._initializeContactsWindow();
        this._initializeSettingsWindow();

        this._contactsWindow.present();

        // this._removeContactButton.connect('clicked', Lang.bind(this, function()
        // {
        //     this._pontarius.removePeerRemote(this._contactsListbox.get_selected_row().get_child().get_children()[1].get_label(), Lang.bind(this, function(result, error)
        //     {
        //         if(error === null)
        //         {
        //             this._populateContactsListBox();
        //         }
        //         else
        //         {
        //             print('removePeer failure! ' + Gio.DBusError.get_remote_error(error));
        //         }
        //     }));
        // }));

        // contactHistoryButton.connect('clicked', Lang.bind(this, function()
        // {
        //     let treeView = this._builder.get_object('history_treeview');
        //     let listStore = new Gtk.ListStore();
        //     listStore.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING]);
        //     let data = [
        //         ['2014-09-07 19:18 CET', '2FBAF74694EB0556', 'B52F81E2459FF0972BCF008BE59BDA70BDCBAD03', 'D36539A4F0083D6B75DD504D79644DF2E0DC567C'],
        //         ['2014-09-07 19:19 CET', '2FBAF74694EB0556', 'B52F81E2459FF0972BCF008BE59BDA70BDCBAD03', 'D36539A4F0083D6B75DD504D79644DF2E0DC567C'],
        //         ['2014-09-07 19:20 CET', '2FBAF74694EB0556', 'B52F81E2459FF0972BCF008BE59BDA70BDCBAD03', 'D36539A4F0083D6B75DD504D79644DF2E0DC567C']
        //     ];
        //     for(let i = 0; i < data.length; i++)
        //     {
        //         listStore.set(listStore.append(), [0, 1, 2, 3], data[i]);
        //     }
        //     treeView.set_model(listStore);
        //     treeView.insert_column(new Gtk.TreeViewColumn({ title: "Date" }), 0);
        //     treeView.insert_column(new Gtk.TreeViewColumn({ title: "Session ID" }), 1);
        //     treeView.insert_column(new Gtk.TreeViewColumn({ title: "Our Identity" }), 2);
        //     treeView.insert_column(new Gtk.TreeViewColumn({ title: "Their Identity" }), 3);
        //     this._builder.get_object('history_dialog').run(); // TODO: Set transient and onDeleteEvent
        // }));

        // this._builder.get_object('history_button').connect('clicked', Lang.bind(this, function()
        // {
        //     this._builder.get_object('history_dialog').hide();
        // }));
        // this._addContactButton.connect('clicked', Lang.bind(this, function()
        // {
        //     this._builder.get_object('add_contact_entry').set_text('');
        //     this._builder.get_object('add_contact_dialog').run(); // TODO: Set transient and onDeleteEvent
        // }));
        // this._builder.get_object('add_contact_cancel_button').connect('clicked', Lang.bind(this, function()
        // {
        //     this._builder.get_object('add_contact_dialog').hide();
        // }));
        // this._builder.get_object('add_contact_add_button').connect('clicked', Lang.bind(this, function()
        // {
        //     this._pontarius.addPeerRemote(this._builder.get_object('add_contact_entry').get_text(), Lang.bind(this, function(result, error)
        //     {
        //     }));
        //     this._builder.get_object('add_contact_dialog').hide();
        // }));

        // this._hideTrustRegion();

        // Initialize D-Bus interface.
        const PontariusInterface = '<node name="pontarius"><interface name="org.pontarius"><method name="addPeer"><arg name="jid" type="s" direction="in"/></method><method name="createIdentity"><arg name="key_id" type="ay" direction="out"/></method><method name="getContactIdentities"><arg name="contact" type="s" direction="in"/><arg name="identities" type="a{sas}" direction="out"/></method><method name="getContactPeers"><arg name="contact" type="s" direction="in"/><arg name="peers" type="a{sa{ss}}" direction="out"/></method><method name="getContacts"><arg name="contacts" type="a((ss)b)" direction="out"/></method><method name="getCredentials"><arg name="username" type="s" direction="out"/></method><method name="getIdentities"><arg name="identities" type="as" direction="out"/></method><method name="getIdentityChallenges"><arg name="key_id" type="s" direction="in"/><arg name="challenges" type="a(ssbsssb)" direction="out"/></method><method name="getSessionsByIdentity"><arg name="jid" type="s" direction="in"/><arg name="sessions" type="a(ayssssuu)" direction="out"/></method><method name="getSessionsByJID"><arg name="jid" type="s" direction="in"/><arg name="sessions" type="a(ayssssuu)" direction="out"/></method><method name="keyTrustStatus"><arg name="key_id" type="s" direction="in"/><arg name="is_trusted" type="b" direction="out"/></method><method name="getUnlinkedPeers"><arg name="unlinkedPeers" type="a{ss}" direction="out"/></method><method name="initialize"><arg name="state" type="y" direction="out"/></method><method name="initiateChallenge"><arg name="peer" type="s" direction="in"/><arg name="question" type="s" direction="in"/><arg name="secret" type="s" direction="in"/></method><method name="linkIdentity"><arg name="identity" type="s" direction="in"/><arg name="contact" type="s" direction="in"/></method><method name="identityVerified"><arg name="key_id" type="s" direction="in"/><arg name="is_verified" type="b" direction="in"/></method><method name="newContact"><arg name="name" type="s" direction="in"/><arg name="contact_id" type="s" direction="out"/></method><method name="removeChallenge"><arg name="challenge_id" type="s" direction="in"/></method><method name="removeContacts"><arg name="contact" type="s" direction="in"/></method><method name="removePeer"><arg name="peer" type="s" direction="in"/></method><method name="renameContact"><arg name="contact" type="s" direction="in"/><arg name="name" type="s" direction="in"/></method><method name="respondChallenge"><arg name="peer" type="s" direction="in"/><arg name="secret" type="s" direction="in"/></method><method name="revokeIdentity"><arg name="key_id" type="s" direction="in"/></method><method name="setCredentials"><arg name="username" type="s" direction="in"/><arg name="password" type="s" direction="in"/></method><method name="setIdentity"><arg name="keyID" type="s" direction="in"/></method><method name="unlinkIdentity"><arg name="identity" type="s" direction="in"/></method><signal name="challengeResult"><arg name="peer" type="s"/><arg name="challenge_id" type="s"/><arg name="initiator" type="s"/><arg name="result" type="b"/></signal><signal name="contactRemoved"><arg name="contact" type="s"/></signal><signal name="contactRenamed"><arg name="contact" type="s"/><arg name="name" type="s"/></signal><signal name="contactStatusChanged"><arg name="contact" type="s"/><arg name="contact_name" type="s"/><arg name="status" type="y"/></signal><signal name="identityStatusChanged"><arg name="identity" type="s"/><arg name="peer" type="s"/><arg name="contact" type="s"/><arg name="status" type="y"/></signal><signal name="identityUnlinkedSignal"><arg name="identity" type="s"/></signal><signal name="peerTrustStatusChanged"><arg name="peer" type="s"/><arg name="trust_status" type="b"/></signal><signal name="receivedChallenge"><arg name="peer" type="s"/><arg name="question" type="s"/></signal><signal name="subscriptionRequest"><arg name="peer" type="s"/></signal><signal name="unlinkedIdentityStatusChanged"><arg name="identity" type="s"/><arg name="peer" type="s"/><arg name="status" type="y"/></signal><property name="Identity" type="s" access="read"/><property name="Status" type="y" access="read"/><property name="AccountEnabled" type="b" access="readwrite"/><property name="Username" type="s" access="read"/></interface></node>';
        const PropertiesInterface = '<node name="pontarius"><interface name="org.freedesktop.DBus.Properties"><method name="Get"><arg name="interface_name" type="s" direction="in"/><arg name="property_name" type="s" direction="in"/><arg name="value" type="v" direction="out"/></method><method name="Set"><arg name="interface_name" type="s" direction="in"/><arg name="property_name" type="s" direction="in"/><arg name="value" type="v" direction="in"/></method><method name="GetAll"><arg name="interface_name" type="s" direction="in"/><arg name="props" type="a{sv}" direction="out"/></method><signal name="PropertiesChanged"><arg name="interface_name" type="s"/><arg name="changed_properties" type="a{sv}"/><arg name="invalidated_properties" type="as"/></signal></interface></node>';
        const PontariusProxy = Gio.DBusProxy.makeProxyWrapper(PontariusInterface);
        const PropertiesProxy = Gio.DBusProxy.makeProxyWrapper(PropertiesInterface);
        this._pontarius = new PontariusProxy(Gio.DBus.session, 'org.pontarius', '/pontarius');
        this._properties = new PropertiesProxy(Gio.DBus.session, 'org.pontarius', '/pontarius');
        this._pontarius.set_default_timeout(1000 * 60 * 10);
        this._propertiesChangedId = this._properties.connectSignal('PropertiesChanged', Lang.bind(this, this._onPropertiesChanged));
        this._pontarius.initializeRemote(Lang.bind(this, this._onStatusChanged));

        // this._populateContactsListBox();
    },
    _initializeMenu: function() {
        this._builder.add_from_file('app-menu.ui');

        let settingsAction = new Gio.SimpleAction({ name: 'settings' });
        settingsAction.connect('activate', Lang.bind(this, this._onSettingsAction));
        this.add_action(settingsAction);

        let quitAction = new Gio.SimpleAction({ name: 'quit' });
        quitAction.connect('activate', Lang.bind(this, this._onQuitAction));
        this.add_action(quitAction);

        let menu = this._builder.get_object('app-menu');
        this.set_app_menu(menu);
    },
    _initializeContactsWindow: function() {
        this._contactsWindow = this._builder.get_object('contacts_window');

        this._contactSettingsButton = this._builder.get_object('contacts_settings_button');
        this._contactHistoryButton = this._builder.get_object('contacts_history_button');
        this._contactsListbox = this._builder.get_object('contacts_listbox');
        this._addContactButton = this._builder.get_object('contacts_add_button');
        this._removeContactButton = this._builder.get_object('contacts_remove_button');

        this.add_window(this._contactsWindow);
    },
    _onDeleteEvent: function(window) {
        window.hide();
        return true;
    },
    _initializeSettingsWindow: function() {
        this._settingsWindow = this._builder.get_object('settings_window');

        this._loginAutomaticallySwitch = this._builder.get_object('settings_login_automatically_switch');
        this._selectIdentityButton = this._builder.get_object('identity_management_toolitem_left_select_button');
        this._accountValue = this._builder.get_object('settings_xmpp_account_value');

        let accountApplyButton = this._builder.get_object('xmpp_account_apply_button');
        let accountCancelButton = this._builder.get_object('xmpp_account_cancel_button');
        let addressEntry = this._builder.get_object('xmpp_account_xmpp_address_entry');
        let passwordEntry = this._builder.get_object('xmpp_account_password_entry');
        let accountDialog = this._builder.get_object('xmpp_account_dialog');
        let identityManagementCloseButton = this._builder.get_object('identity_management_close_button');
        let identityManagementDialog = this._builder.get_object('identity_management_dialog');
        let settingsListbox = this._builder.get_object('settings_listbox');
        let accountRow = this._builder.get_object('settings_xmpp_account_row');
        let identityRow = this._builder.get_object('settings_identity_row');
        let identityManagementListbox = this._builder.get_object('identity_management_listbox');
        let addIdentityButton = this._builder.get_object('identity_management_toolitem_left_add_button');
        let generatingIdentityDialog = this._builder.get_object('generating_identity_dialog');
        let revokeIdentityButton = this._builder.get_object('identity_management_toolitem_right_revoke_button');
        let revokeIdentityDialog = this._builder.get_object('revoke_identity_dialog');
        let innerRevokeIdentityButton = this._builder.get_object('revoke_identity_revoke_button');
        let cancelRevocationButton = this._builder.get_object('revoke_identity_cancel_button');

        this._settingsWindow.set_resizable(false);
        this._settingsWindow.set_transient_for(this._contactsWindow);
        this._settingsWindow.set_destroy_with_parent(true);
        this.add_window(this._settingsWindow);
        this._settingsWindow.connect('delete-event', Lang.bind(this, this._onDeleteEvent));

        accountApplyButton.connect('clicked', Lang.bind(this, function()
        {
            this._pontarius.setCredentialsRemote(
                addressEntry.get_text(),
                passwordEntry.get_text(),
                Lang.bind(this, function(result, error) {
                    if(error === null) {
                        accountDialog.hide();
                    }
                    else {
                        print('setCredentials failure! ' + Gio.DBusError.get_remote_error(error));
                        let dialog = new Gtk.MessageDialog({
                            buttons: Gtk.ButtonsType.OK,
                            message_type: Gtk.MessageType.ERROR,
                            modal: true,
                            text: "Failed to set credentials. Please verify that the username is in the form localpart@domainpart.",
                            transient_for: accountDialog });
                        dialog.connect('response', function() { dialog.hide(); });
                        dialog.connect('delete-event', Lang.bind(this, this._onDeleteEvent));
                        dialog.show();
                    }
                })
            );
        }));

        accountCancelButton.connect('clicked', Lang.bind(this, function() {
            accountDialog.hide();
        }));

        identityManagementCloseButton.connect('clicked', Lang.bind(this, function()
        {
            identityManagementDialog.hide();
        }));
        settingsListbox.connect('row-activated', Lang.bind(this, function(listbox, listboxRow)
        {
            switch(listboxRow)
            {
                case accountRow:
                {
                    addressEntry.set_text('');
                    passwordEntry.set_text('');
                    accountDialog.connect('delete-event', Lang.bind(this, this._onDeleteEvent));
                    accountDialog.set_transient_for(this._settingsWindow);
                    accountDialog.run();
                    break;
                }
                case identityRow:
                {
                    if(this._state != State.CREDENTIALS_UNSET)
                    {
                        this._populateIdentityListBox(identityManagementListbox);
                        identityManagementDialog.connect('delete-event', Lang.bind(this, this._onDeleteEvent));
                        identityManagementDialog.set_transient_for(this._settingsWindow);
                        identityManagementDialog.run();
                    }
                    break;
                }
            }
        }));
        this._loginAutomaticallySwitch.connect('notify::active', Lang.bind(this, function(self)
        {
            this._pontarius.AccountEnabled = self.get_active();
        }));
        this._selectIdentityButton.connect('clicked', Lang.bind(this, function()
        {
            this._pontarius.setIdentityRemote(identityManagementListbox.get_selected_row().get_child().get_children()[0].get_label(), Lang.bind(this, function(result, error)
            {
                if(error === null)
                {
                    this._populateIdentityListBox(identityManagementListbox);
                }
                else
                {
                    print('setIdentity failure! ' + Gio.DBusError.get_remote_error(error));
                }
            }));
        }));
        addIdentityButton.connect('clicked', Lang.bind(this, function()
        {
            generatingIdentityDialog.connect('delete-event', Lang.bind(this, this._onDeleteEvent));
            generatingIdentityDialog.set_transient_for(identityManagementDialog);
            generatingIdentityDialog.show();

            this._pontarius.createIdentityRemote(Lang.bind(this, function(result, error)
            {
                generatingIdentityDialog.hide();
                this._populateIdentityListBox(identityManagementListbox);
            }));
        }));
        revokeIdentityButton.connect('clicked', Lang.bind(this, function() {
            revokeIdentityDialog.connect('delete-event', Lang.bind(this, this._onDeleteEvent));
            revokeIdentityDialog.set_transient_for(identityManagementDialog);
            revokeIdentityDialog.run();
        }));
        innerRevokeIdentityButton.connect('clicked', Lang.bind(this, function()
        {
            let selectedIdentity = identityManagementListbox.get_selected_row().get_child().get_children()[0].get_label();
            revokeIdentityDialog.hide();
            this._pontarius.revokeIdentitySync(selectedIdentity);
            this._populateIdentityListBox(identityManagementListbox);
            if(selectedIdentity == this._pontarius.Identity)
            {
                this._pontarius.Identity = null;
            }
        }));
        cancelRevocationButton.connect('clicked', Lang.bind(this, function() {
            revokeIdentityDialog.hide();
        }));
    },
    _onSettingsAction: function() {
        if(!this._settingsWindow.get_visible()) {
            this._settingsWindow.present();
        }
        else {
            this._settingsWindow.present();
        }
    },
    _onQuitAction: function() {
        this.remove_window(this._settingsWindow);
        this.remove_window(this._contactsWindow);
    },
    _onPropertiesChanged: function(proxy, connection, value) {
        // if(value[1]['Peers'] != undefined)
        // {
        //     this._onPeersChanged();
        // }
        // else if(value[1]['Status'] != undefined)
        // {
        //     this._onStatusChanged(this._pontarius.Status, null);
        // }
    },
    // _hideTrustRegion: function()
    // {
    //     let label = new Gtk.Label({ label: 'Please select a contact.' });
    //     label.set_alignment(0.5, 0.5);
    //     label.show();
    //     this._builder.get_object('cm_box').remove(this._builder.get_object('trust_region'));
    //     this._builder.get_object('cm_box').pack_start(label, true, true, 10);
    // },
    // _showTrustRegion: function(username)
    // {
    //     this._builder.get_object('cm_box').remove(this._builder.get_object('cm_box').get_children()[1]);
    //     this._builder.get_object('cm_box').pack_start(this._builder.get_object('trust_region'), true, true, 0);
    //     this._pontarius.getChallengesRemote(Lang.bind(this, function(challenges, error)
    //     {
    //         if(error === null)
    //         {
    //             this._challenges = challenges;
    //             this._populateChallengesListBox();
    //         }
    //         else
    //         {
    //             this._accountValue.set_text('(Unset)');
    //             print('getCredentials failure! ' + Gio.DBusError.get_remote_error(error));
    //         }
    //     }));
    //     this._pontarius.getEntityPubkeyRemote(username, Lang.bind(this, function(challenges, error)
    //     {
    //         if(error === null)
    //         {
    //             this._identity = result;
    //             this._builder.get_object('identity_verification_label').set_label('Not Verified');
    //         }
    //         else
    //         {
    //             this._identity = null;
    //             this._builder.get_object('identity_verification_label').set_label('No Identity');
    //         }
    //     }));
    // },
    _onStatusChanged: function(result, error) {
        print('_onStatusChanged');

        if(error === null) {
            this._state = result;

            if(result == State.CREDENTIALS_UNSET) {
                print('CREDENTIALS_UNSET');
                this._showAccountValue(false);
                this._showIdentityValue(false);
                this._showAccountEnabled(false, false);
                // this._addContactButton.set_sensitive(false);
                // this._removeContactButton.set_sensitive(false);
                // if(this._gConf.get("/apps/pontarius/username") != undefined && this._gConf.get("/apps/pontarius/password") != undefined)
                // {
                //     this._pontarius.setCredentialsRemote(this._gConf.get("/apps/pontarius/username").to_string(), this._gConf.get("/apps/pontarius/password").to_string(), function(result, error)
                //     {
                //         if(error !== null)
                //         {
                //             print('setCredentials failure! ' + Gio.DBusError.get_remote_error(error));
                //         }
                //     });
                // }
            }
            else if(result == State.IDENTITY_NOT_FOUND) {
                print('IDENTITY_NOT_FOUND');
                this._showAccountValue(true);
                this._showIdentityValue(false);
                this._showAccountEnabled(false, false);
            }
            else if(result == State.IDENTITIES_AVAILABLE) {
                print('IDENTITIES_AVAILABLE');
                this._showAccountValue(true);
                this._showIdentityValue(false);
                this._showAccountEnabled(false, false);
            }
            else if(result == State.CREATING_IDENTITY) {
                print('CREATING_IDENTITY');
                this._showAccountValue(true);
                this._showIdentityValue(false);
                this._showAccountEnabled(false, false);
            }
            else if(result == State.DISABLED) {
                print('DISABLED');
                this._showAccountValue(true);
                this._showIdentityValue(true);
                this._showAccountEnabled(true, false);
            }
            else if(result == State.AUTHENTICATED) {
                print('OTHER STATE');
                this._showAccountValue(true);
                this._showIdentityValue(true);
                this._showAccountEnabled(true, true);
            }
            else {
                print('OTHER STATE');
                this._showAccountValue(true);
                this._showIdentityValue(true);
                this._showAccountEnabled(true, true);
            }
        }
        else
        {
            if(Gio.DBusError.get_remote_error(error)) {
                print('Could not access Pontarius Service.');
            }
            else {
                print('Unexpected error: ' + Gio.DBusError.get_remote_error(error));
            }
        }
    },
    _showAccountValue: function(set)
    {
        if(set)
        {
            this._pontarius.getCredentialsRemote(Lang.bind(this, function(result, error) {
                if(error === null) {
                    this._accountValue.set_text(result + '');
                }
                else {
                    this._accountValue.set_text('(Unset)');
                    print('getCredentials failure! ' + Gio.DBusError.get_remote_error(error));
                }
            }));
        }
        else {
            this._accountValue.set_text('(Unset)');
        }
    },
    _showIdentityValue: function(set) {
        if(set) {
            this._builder.get_object('settings_identity_value').set_text(this._pontarius.Identity + '');
        }
        else {
            this._builder.get_object('settings_identity_value').set_text('(Unset)');
        }
    },
    _showAccountEnabled: function(sensitive, active) {
        this._loginAutomaticallySwitch.set_sensitive(sensitive);
        this._loginAutomaticallySwitch.set_active(active && this._pontarius.AccountEnabled);
    },
    _emptyListBox: function(listbox) {
        let row = null;
        while((row = listbox.get_row_at_index(0)) != null) {
            listbox.remove(row);
        }
    },
    _populateIdentityListBox: function(listbox) {
        this._pontarius.getIdentitiesRemote(Lang.bind(this, function(result, error) {
            if(error === null) {
                this._selectIdentityButton.set_sensitive(false);

                this._emptyListBox(listbox);

                let identities = result[0];

                for(let i = 0; i < identities.length; i++) {
                    let label = new Gtk.Label({ label: identities[i] + '' });
                    label.set_alignment(0, 0.5);
                    label.set_margin_bottom(6);
                    label.set_margin_top(6);
                    label.show();

                    let image = Gtk.Image.new_from_icon_name('object-select-symbolic', 0);
                    if(this._pontarius.Identity + '' == identities[i]) {
                        image.show();
                    }

                    let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
                    box.pack_start(label, true, true, 10);
                    box.pack_start(image, false, true, 10);
                    box.show();

                    listbox.add(box);
                }

                listbox.connect('row-selected', Lang.bind(this, function(box, row) {
                    if(row !== null) {
                        if(row.get_child().get_children()[0].get_label() == this._pontarius.Identity) {
                            this._selectIdentityButton.set_sensitive(false);
                        }
                        else {
                            this._selectIdentityButton.set_sensitive(true);
                        }
                    }
                    else {
                        print('Row deselected!');
                    }
                }));
            }
            else {
                print('getIdentities failure! ' + Gio.DBusError.get_remote_error(error));
            }
        }));
    },
    // _onPeersChanged: function(result, error)
    // {
    //     print('_onPeersChanged');

    //     this._populateContactsListBox();
    // },
    // _populateContactsListBox: function()
    // {
    //     this._removeContactButton.set_sensitive(false);
    //     this._contactSettingsButton.set_sensitive(false);
    //     contactHistoryButton.set_sensitive(false);

    //     this._emptyListBox(this._contactsListbox);

    //     let peers = this._pontarius.Peers;

    //     if(peers == null)
    //     {
    //         return;
    //     }

    //     let onlinePeers = [];
    //     let offlinePeers = [];

    //     for(let i = 0; i < peers.length; i++)
    //     {
    //         let [address, online] = peers[i];

    //         if(online)
    //         {
    //             onlinePeers.push([address, true]);
    //         }
    //         else
    //         {
    //             offlinePeers.push([address, false]);
    //         }
    //     }

    //     peers = onlinePeers.concat(offlinePeers);

    //     for(let i = 0; i < peers.length; i++)
    //     {
    //         let [address, online] = peers[i];

    //         let availabilityLabel = new Gtk.Label();
    //         if(online)
    //         {
    //             availabilityLabel.set_markup('<span color="#8ae234" font="16">●</span>');
    //         }
    //         else
    //         {
    //             availabilityLabel.set_markup('<span color="#aaaaaa" font="16">●</span>');
    //         }
    //         availabilityLabel.set_alignment(0, 0.5);
    //         availabilityLabel.set_margin_bottom(6);
    //         availabilityLabel.set_margin_top(6);
    //         availabilityLabel.show();

    //         let addressLabel = new Gtk.Label({ label: address + '' });
    //         addressLabel.set_alignment(0, 0.5);
    //         addressLabel.set_margin_bottom(6);
    //         addressLabel.set_margin_top(6);
    //         addressLabel.show();

    //         let image = Gtk.Image.new_from_icon_name('object-select-symbolic', 0);
    //         // if()
    //         // {
    //         //    image.show();
    //         // }
    //         // else
    //         // {
    //             image.clear();
    //         // }


    //         // GtkBox
    //         let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
    //         box.pack_start(availabilityLabel, false, true, 10);
    //         box.pack_start(addressLabel, true, true, 0);
    //         box.pack_start(image, false, true, 10);
    //         box.show();

    //         this._contactsListbox.add(box);
    //     }

    //     this._contactsListbox.connect('row-selected', Lang.bind(this, function(box, row)
    //     {
    //         if(row !== null)
    //         {
    //             this._removeContactButton.set_sensitive(true);
    //             this._contactSettingsButton.set_sensitive(true);
    //             contactHistoryButton.set_sensitive(true);
    //             this._showTrustRegion(row.get_child().get_children()[1].get_label());
    //         }
    //         else
    //         {
    //             this._hideTrustRegion();
    //             this._removeContactButton.set_sensitive(false);
    //             this._contactSettingsButton.set_sensitive(false);
    //             contactHistoryButton.set_sensitive(false);
    //         }
    //     }));
    // },
    // _populateChallengesListBox: function()
    // {
    //     let listbox = this._builder.get_object('challenge_listbox');
    //     let challenges = this._challenges;

    //     this._builder.get_object('challenge_remove_button').set_sensitive(false);

    //     this._emptyListBox(listbox);

    //     for(let i = 0; i < challenges.length; i++)
    //     {
    //     }

    //     listbox.connect('row-selected', Lang.bind(this, function(box, row)
    //     {
    //         if(row !== null)
    //         {
    //             this._builder.get_object('challenge_remove_button').set_sensitive(false);
    //         }
    //         else
    //         {
    //             print('Row deselected!');
    //         }
    //     }));
    // }
});

new Contacts().run(ARGV);
