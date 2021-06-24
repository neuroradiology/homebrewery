require('./newPage.less');
const React = require('react');
const createClass = require('create-react-class');
const _ = require('lodash');
const request = require('superagent');
const dedent = require('dedent-tabs').default;

const Markdown = require('naturalcrit/markdown.js');

const Nav = require('naturalcrit/nav/nav.jsx');
const Navbar = require('../../navbar/navbar.jsx');
const AccountNavItem = require('../../navbar/account.navitem.jsx');
const RecentNavItem = require('../../navbar/recent.navitem.jsx').both;
const IssueNavItem = require('../../navbar/issue.navitem.jsx');

const SplitPane = require('naturalcrit/splitPane/splitPane.jsx');
const Editor = require('../../editor/editor.jsx');
const BrewRenderer = require('../../brewRenderer/brewRenderer.jsx');

const KEY = 'homebrewery-new';

const NewPage = createClass({
	getDefaultProps : function() {
		return {
			brew : {
				text  : '',
				style : dedent`
										/*=======---  Example CSS styling  ---=======*/
										/* Any CSS here will apply to your document! */
										
										.myExampleClass {
							 			  color: black;
										}`,
				shareId   : null,
				editId    : null,
				createdAt : null,
				updatedAt : null,
				gDrive    : false,

				title       : '',
				description : '',
				tags        : '',
				published   : false,
				authors     : [],
				systems     : []
			}
		};
	},

	getInitialState : function() {
		return {
			brew : {
				text        : this.props.brew.text || '',
				style       : this.props.brew.style || '',
				gDrive      : false,
				title       : this.props.brew.title || '',
				description : this.props.brew.description || '',
				tags        : this.props.brew.tags || '',
				published   : false,
				authors     : [],
				systems     : this.props.brew.systems || [],
				renderer    : this.props.brew.renderer || 'legacy'
			},

			isSaving   : false,
			saveGoogle : (global.account && global.account.googleId ? true : false),
			errors     : [],
			htmlErrors : Markdown.validate(this.props.brew.text)
		};
	},

	componentDidMount : function() {
		const storage = localStorage.getItem(KEY);
		if(!this.props.brew.text && storage){
			this.setState({
				brew : { text: storage }
			});
		}

		this.setState((prevState)=>({
			htmlErrors : Markdown.validate(prevState.brew.text)
		}));

		document.addEventListener('keydown', this.handleControlKeys);
	},
	componentWillUnmount : function() {
		document.removeEventListener('keydown', this.handleControlKeys);
	},

	handleControlKeys : function(e){
		if(!(e.ctrlKey || e.metaKey)) return;
		const S_KEY = 83;
		const P_KEY = 80;
		if(e.keyCode == S_KEY) this.save();
		if(e.keyCode == P_KEY) this.print();
		if(e.keyCode == P_KEY || e.keyCode == S_KEY){
			e.stopPropagation();
			e.preventDefault();
		}
	},

	handleSplitMove : function(){
		this.refs.editor.update();
	},

	handleTextChange : function(text){
		//If there are errors, run the validator on every change to give quick feedback
		let htmlErrors = this.state.htmlErrors;
		if(htmlErrors.length) htmlErrors = Markdown.validate(text);

		this.setState((prevState)=>({
			brew       : _.merge({}, prevState.brew, { text: text }),
			htmlErrors : htmlErrors
		}));
		localStorage.setItem(KEY, text);
	},

	handleStyleChange : function(style){
		this.setState((prevState)=>({
			brew : _.merge({}, prevState.brew, { style: style }),
		}));
	},

	handleMetaChange : function(metadata){
		this.setState((prevState)=>({
			brew : _.merge({}, prevState.brew, metadata),
		}));

	},

	save : async function(){
		this.setState({
			isSaving : true
		});

		console.log('saving new brew');

		if(this.state.saveGoogle) {
			const res = await request
			.post('/api/newGoogle/')
			.send(this.state.brew)
			.catch((err)=>{
				console.log(err.status === 401
					? 'Not signed in!'
					: 'Error Creating New Google Brew!');
				this.setState({ isSaving: false });
				return;
			});

			const brew = res.body;
			localStorage.removeItem(KEY);
			window.location = `/edit/${brew.googleId}${brew.editId}`;
		} else {
			request.post('/api')
			.send(this.state.brew)
			.end((err, res)=>{
				if(err){
					this.setState({
						isSaving : false
					});
					return;
				}
				window.onbeforeunload = function(){};
				const brew = res.body;
				localStorage.removeItem(KEY);
				window.location = `/edit/${brew.editId}`;
			});
		}
	},

	renderSaveButton : function(){
		if(this.state.isSaving){
			return <Nav.item icon='fas fa-spinner fa-spin' className='saveButton'>
				save...
			</Nav.item>;
		} else {
			return <Nav.item icon='fas fa-save' className='saveButton' onClick={this.save}>
				save
			</Nav.item>;
		}
	},

	print : function(){
		localStorage.setItem('print', `<style>\n${this.state.brew.style}\n</style>\n\n${this.state.brew.text}`);
		window.open('/print?dialog=true&local=print', '_blank');
	},

	renderLocalPrintButton : function(){
		return <Nav.item color='purple' icon='far fa-file-pdf' onClick={this.print}>
			get PDF
		</Nav.item>;
	},

	renderNavbar : function(){
		return <Navbar>

			<Nav.section>
				<Nav.item className='brewTitle'>{this.state.brew.title}</Nav.item>
			</Nav.section>

			<Nav.section>
				{this.renderSaveButton()}
				{this.renderLocalPrintButton()}
				<IssueNavItem />
				<RecentNavItem />
				<AccountNavItem />
			</Nav.section>
		</Navbar>;
	},

	render : function(){
		return <div className='newPage page'>
			{this.renderNavbar()}
			<div className='content'>
				<SplitPane onDragFinish={this.handleSplitMove} ref='pane'>
					<Editor
						ref='editor'
						brew={this.state.brew}
						onTextChange={this.handleTextChange}
						onStyleChange={this.handleStyleChange}
						onMetaChange={this.handleMetaChange}
						renderer={this.state.brew.renderer}
					/>
					<BrewRenderer text={this.state.brew.text} style={this.state.brew.style} renderer={this.state.brew.renderer} errors={this.state.htmlErrors}/>
				</SplitPane>
			</div>
		</div>;
	}
});

module.exports = NewPage;
