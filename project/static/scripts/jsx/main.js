var axios = require('axios');
var react = require('react');


class Nav extends react.Component {  

  constructor(props){
    super(props);
    this.testGet();
  };

  render(){
    return (
      <nav id="mainNav" className="navbar navbar-default navbar-fixed-top navbar-custom">
        <div className="container">
          <div className="navbar-header page-scroll">
            <button type="button" className="navbar-toggle" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1">
              <span className="sr-only">Toggle navigation</span> Menu <i className="fa fa-bars" />
            </button>
            <a className="navbar-brand" href="/">Imgrab</a>
          </div>
          <div className="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
            <ul className="nav navbar-nav navbar-right">
              <li className="hidden">
                <a href="#page-top" />
              </li>
              <li className="page-scroll">
                <a href="/images">My Images</a>
              </li>
              <li className="page-scroll">
                <a href="#">Help</a>
              </li>
              <li className="page-scroll">
                <a href="#">Contact</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    );
  };

  testGet() {
    axios.get('http://127.0.0.1:5000/api/images')
    .then(function (response) {
      console.log(response);
    })
    .catch(function (error) {
      console.log(error);
    });
  }

};



// class PageContainer extends Component {
//   render() {
//     return (
//       <div className="page-container">
//         {this.props.children}
//       </div>
//     );
//   }
// }



var PageContainer = React.createClass({
  render() {
    return (
      <div className="page-container">
        {this.props.children}
      </div>
    );
  }
});

var DynamicSearch = React.createClass({

  // sets initial state
  getInitialState: function(){
    return { searchString: '' };
  },

  // sets state, triggers render method
  handleChange: function(event){
    // grab value form input box
    this.setState({searchString:event.target.value});
    console.log("scope updated!");
  },

  render: function() {

    var countries = this.props.items;
    var searchString = this.state.searchString.trim().toLowerCase();

    // filter countries list by value from input box
    if(searchString.length > 0){
      countries = countries.filter(function(country){
        return country.name.toLowerCase().match( searchString );
      });
    }

    return (
      <div className="search-component">
        <input type="text" value={this.state.searchString} onChange={this.handleChange} placeholder="Search!" />
        <ul>
          { countries.map(function(country){ return <li>{country.name} </li> }) }
        </ul>
      </div>
    )
  }

});

// list of countries, defined with JavaScript object literals
var countries = [
  {"name": "Sweden"}, {"name": "China"}, {"name": "Peru"}, {"name": "Czech Republic"},
  {"name": "Bolivia"}, {"name": "Latvia"}, {"name": "Samoa"}, {"name": "Armenia"},
  {"name": "Greenland"}, {"name": "Cuba"}, {"name": "Western Sahara"}, {"name": "Ethiopia"},
  {"name": "Malaysia"}, {"name": "Argentina"}, {"name": "Uganda"}, {"name": "Chile"},
  {"name": "Aruba"}, {"name": "Japan"}, {"name": "Trinidad and Tobago"}, {"name": "Italy"},
  {"name": "Cambodia"}, {"name": "Iceland"}, {"name": "Dominican Republic"}, {"name": "Turkey"},
  {"name": "Spain"}, {"name": "Poland"}, {"name": "Haiti"}
];



var ImageGrid = React.createClass({
  render: function() {
    return (
        <div className="row" id="image_container">
        </div>
    );
  }
});
  


let MainContent = (
  <div>
    <Nav />
    <PageContainer>
      <DynamicSearch items={ countries } />
    </PageContainer>
  </div>
);

ReactDOM.render(
  MainContent , 
  document.getElementById("app-container")
);

// var MainContent = React.createClass({
//     render: function(){
//         return (
//             <div className="main-content">
//               <Nav />
//               <PageContainer>
//                 <DynamicSearch items={ countries } />
//               </PageContainer>
//             </div>
//         )
//     }
// });



// ReactDOM.render(
//   <MainContent />, 
//   document.getElementById("app-container")
// );