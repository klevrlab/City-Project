/**
 * System to manage the tour events and their state.
 */
AFRAME.registerSystem('event-system', {
  init: function () {
    this.dummyEvents = [
      {
        title: "The Big Game",
        date: "February 9, 2026",
        time: "3:30 PM PST",
        location: "SAP Center, San Jose",
        description: "Experience the ultimate showdown! Join thousands of fans for an unforgettable game day.",
        sharkeyMessage: "Hey there! I'm Sharkie, and this is where the magic happens! SAP Center hosts over 200 events per year. Arrive early to grab some teal gear!",
        icon: "./assets/the-big-game.svg"
      },
      {
        title: "March Madness Watch Party",
        date: "March 15-April 6, 2026",
        time: "Various Times",
        location: "Downtown San Jose",
        description: "Catch all the tournament action on giant screens across downtown venues.",
        sharkeyMessage: "Downtown SJ is buzzing! Over 40 restaurants and bars showing the games. San Pedro Square Market has the best viewing atmosphere!",
        icon: "./march-madness.svg"
      },
      {
        title: "World Cup Viewing",
        date: "June-July 2026",
        time: "Match Times Vary",
        location: "San Pedro Square Market",
        description: "Cheer for your team with fans from around the world in the heart of SJ.",
        sharkeyMessage: "¡Hola! This historic market has been a gathering place since 1863. Try food from different countries while watching their teams play!",
        icon: "./world-cup.svg"
      }
    ];
    this.currentEventIndex = 0;
  },

  getCurrentEvent: function () {
    return this.dummyEvents[this.currentEventIndex];
  },

  getNextEvent: function () {
    this.currentEventIndex = (this.currentEventIndex + 1) % this.dummyEvents.length;
    return this.dummyEvents[this.currentEventIndex];
  }
});
