(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Nav = React.createClass({displayName: "Nav",
  render: function() {
    return (

      React.createElement("nav", {id: "mainNav", className: "navbar navbar-default navbar-fixed-top navbar-custom"}, 
        React.createElement("div", {className: "container"}, 
          React.createElement("div", {className: "navbar-header page-scroll"}, 
            React.createElement("button", {type: "button", className: "navbar-toggle", "data-toggle": "collapse", "data-target": "#bs-example-navbar-collapse-1"}, 
              React.createElement("span", {className: "sr-only"}, "Toggle navigation"), " Menu ", React.createElement("i", {className: "fa fa-bars"})
            ), 
            React.createElement("a", {className: "navbar-brand", href: "/"}, "Imgrab")
          ), 
          React.createElement("div", {className: "collapse navbar-collapse", id: "bs-example-navbar-collapse-1"}, 
            React.createElement("ul", {className: "nav navbar-nav navbar-right"}, 
              React.createElement("li", {className: "hidden"}, 
                React.createElement("a", {href: "#page-top"})
              ), 
              React.createElement("li", {className: "page-scroll"}, 
                React.createElement("a", {href: "/images"}, "My Images")
              ), 
              React.createElement("li", {className: "page-scroll"}, 
                React.createElement("a", {href: "#"}, "Help")
              ), 
              React.createElement("li", {className: "page-scroll"}, 
                React.createElement("a", {href: "#"}, "Contact")
              )
            )
          )
        )
      )
    );
  }
});



// class PageContainer extends Component {
//   render() {
//     return (
//       <div className="page-container">
//         {this.props.children}
//       </div>
//     );
//   }
// }



var PageContainer = React.createClass({displayName: "PageContainer",
  render() {
    return (
      React.createElement("div", {className: "page-container"}, 
        this.props.children
      )
    );
  }
});

var DynamicSearch = React.createClass({displayName: "DynamicSearch",

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
      React.createElement("div", {className: "search-component"}, 
        React.createElement("input", {type: "text", value: this.state.searchString, onChange: this.handleChange, placeholder: "Search!"}), 
        React.createElement("ul", null, 
           countries.map(function(country){ return React.createElement("li", null, country.name, " ") }) 
        )
      )
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


let MainContent = (
  React.createElement("div", null, 
    React.createElement(Nav, null), 
    React.createElement(PageContainer, null, 
      React.createElement(DynamicSearch, {items:  countries })
    )
  )
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

},{}]},{},[1]);
